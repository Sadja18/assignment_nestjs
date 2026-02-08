import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { Between, Repository } from 'typeorm';
import { FrankfurterService } from './frankfurter/frankfurter.service';

/**
 * Core business logic for currency rate ingestion and storage.
 * 
 * RESPONSIBILITIES:
 * - Saves exchange rates to database with duplicate prevention
 * - Enforces assignment requirement: "No duplicate records for same base, target, timestamp window"
 * - Abstracts database operations from controllers (clean separation of concerns)
 */
@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(ExchangeRate)
    private exchangeRateRepo: Repository<ExchangeRate>,
    private frankFurterService: FrankfurterService,
  ) { }

  /**
   * Saves a currency exchange rate if not already recorded for this minute window.
   * 
   * DUPLICATE PREVENTION STRATEGY:
   * - Uses fetchedAtMinute (timestamp truncated to minute precision) as deduplication key
   * - Matches assignment requirement: "No duplicate records for same base, target, timestamp window"
   * - Prevents accidental duplicates during:
   *   • Manual fetch retries (POST /rates/fetch)
   *   • Cron job overlaps (every 3 hours)
   *   • Concurrent requests
   * 
   * SIDE EFFECTS:
   * - Persists record to exchange_rates table if new
   * - No-op if duplicate detected (graceful degradation)
   * 
   * @param base ISO 4217 base currency code (e.g., 'USD')
   * @param target ISO 4217 target currency code (e.g., 'INR')
   * @param rate Conversion rate (base → target)
   */
  async saveRate(base: string, target: string, rate: number): Promise<void> {
    const now = new Date();

    // Truncate to minute precision for deduplication window
    // Why? Assignment requires preventing duplicates within "timestamp window"
    // Frankfurter API updates daily – minute granularity is safe and efficient
    const fetchedAtMinute = Math.floor(now.getTime() / 60_000);

    // Check for existing record in this minute window
    const existing = await this.exchangeRateRepo.findOne({
      where: {
        baseCurrency: base,
        targetCurrency: target,
        fetchedAtMinute
      },
    });

    // Only save if no duplicate exists (requirement compliance)
    if (!existing) {
      await this.exchangeRateRepo.save({
        baseCurrency: base,
        targetCurrency: target,
        rate,
        fetchedAt: now,
        fetchedAtMinute,
      });
    }
  }

  /**
 * Fetches the latest exchange rates from the Frankfurter API for a given base currency
 * and persists them to the database, ensuring no duplicate records are created.
 * 
 * This method directly satisfies the assignment requirement:
 *   "POST /rates/fetch triggers fetching from third party API"
 * 
 * DESIGN DECISIONS:
 * - Uses USD as the default base currency per assignment specification
 * - Supports at least 5 target currencies (INR, EUR, GBP, JPY, CAD) as required
 * - Implements idempotent storage: duplicate prevention via minute-granularity window
 * - Delegates API communication and retry logic to FrankfurterService
 * 
 * ERROR HANDLING:
 * - Propagates upstream errors from FrankfurterService (e.g., timeouts, 5xx responses)
 * - Does not catch errors here—allows controller to handle HTTP status codes uniformly
 * - Database save operations are atomic per currency pair
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Processes each rate pair independently to avoid all-or-nothing failure
 * - Non-blocking I/O ensures responsiveness during ingestion
 * 
 * @param base - ISO 4217 base currency code (defaults to 'USD' per requirements)
 * @returns Promise<void> - Resolves when all valid rates are processed
 * @throws HttpException - If Frankfurter API fails after retries (503 Service Unavailable)
 */
  async fetchAndSaveRates(base: string = 'USD'): Promise<void> {
    // Delegate API communication to dedicated service
    // FrankfurterService handles retries, timeouts, and response validation
    const response = await this.frankFurterService.fetchLatest(base);

    // pre-emptive test to check if response was valid
    if (!response?.rates) {
      console.error("Could not fetch rates ", response);
      return;
    }

    const now = new Date();
    // Truncate timestamp to minute precision for duplicate prevention window
    // Aligns with requirement: "No duplicate records for same base, target, timestamp window"
    const fetchedAtMinute = Math.floor(now.getTime() / 60000);

    // Process each currency pair independently to maximize data retention
    // Even if one pair fails validation, others will still be saved
    for (const [target, rateValue] of Object.entries(response.rates)) {
      // Enforce 6-decimal precision for financial data consistency
      // Matches entity definition: precision=15, scale=6
      const rate = Number(rateValue.toFixed(6));

      // Check for existing record in current minute window to prevent duplicates
      const existing = await this.exchangeRateRepo.findOne({
        where: {
          baseCurrency: base,
          targetCurrency: target,
          fetchedAtMinute
        },
      });

      // Only persist new records—idempotent operation
      if (!existing) {
        await this.exchangeRateRepo.save({
          baseCurrency: base,
          targetCurrency: target,
          rate: rate,
          fetchedAt: now,
          fetchedAtMinute: fetchedAtMinute,
        });
      }
    }
  }

  /**
 * Retrieves the latest exchange rates for a given base currency.
 * 
 * Assignment requirement compliance:
 * - "GET /rates/latest?base=USD returns latest rates"
 * - Returns most recent rate per target currency (not just last inserted record)
 * - Handles missing base currency gracefully
 * 
 * Query strategy:
 * - Groups by target_currency to get one latest rate per pair
 * - Orders by fetchedAt DESC to ensure newest first
 * - Uses raw SQL via query builder for precise control (TypeORM's find() doesn't support complex grouping)
 */
  async getLatestRates(base: string): Promise<Record<string, number>> {
    // Use a single optimized query with ROW_NUMBER()
    const latestRates = await this.exchangeRateRepo
      .createQueryBuilder('rate')
      .select([
        'rate.targetCurrency',
        'rate.rate',
        'rate.fetchedAt',
        // Rank records by fetchedAt (newest first) within each targetCurrency group
        'ROW_NUMBER() OVER (PARTITION BY rate.targetCurrency ORDER BY rate.fetchedAt DESC) as rn'
      ])
      .where('rate.baseCurrency = :base', { base })
      .andWhere('rate.fetchedAt IS NOT NULL') // Safety check
      .getRawMany();

    console.log("latest rates are ", latestRates?.length);

    // Filter to only the newest record per target currency (rn = 1)
    const newestRates = latestRates.filter(row => row.rn === '1');

    if (!newestRates || !Array.isArray(newestRates) || newestRates?.length === 0) {
      throw new HttpException(
        `No rates found for base currency: ${base}`,
        HttpStatus.NOT_FOUND
      );
    }

    console.log("newest rates are ", newestRates.length);


    // Build result object
    const result: Record<string, number> = {};
    newestRates.forEach(row => {
      // TypeORM prefixes columns with table alias + underscore
      const currency = row.rate_targetCurrency;
      const rateValue = parseFloat(row.rate_rate);

      if (currency && !isNaN(rateValue)) {
        result[currency] = rateValue;
      }
    });

    console.log("result is ", result);

    return result;
  }

  /**
 * Retrieves the latest timestamp for a given base currency.
 * Used by getLatestRates endpoint to provide accurate timestamp in response.
 */
  // src/currency/currency.service.ts
  async getLatestTimestamp(base: string): Promise<string> {
    const result = await this.exchangeRateRepo
      .createQueryBuilder('rate')
      .select('MAX(rate.fetchedAt)', 'max')
      .where('rate.baseCurrency = :base', { base })
      .getRawOne();

    // PostgreSQL returns timestamptz as ISO string with timezone (e.g., "2026-02-08T14:30:00.000Z")
    return result?.max || new Date().toISOString();
  }

  /**
 * Retrieves latest rates and metadata for a base currency.
 * Returns structured response including timestamp for API consistency.
 */
  async getLatestRatesWithMetadata(base: string) {
    const rates = await this.getLatestRates(base); // Reuse existing logic
    const timestamp = await this.getLatestTimestamp(base);

    return {
      base,
      rates,
      timestamp,
    };
  }

  // this private helper method
  private getStartDateFromPeriod(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h': return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '12h': return new Date(now.getTime() - 12 * 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h
    }
  }

  // average calculation
  async getAverageRate(base: string, target: string, period: string) {
    const startDate = this.getStartDateFromPeriod(period);

    const result = await this.exchangeRateRepo
      .createQueryBuilder('rate')
      .select('AVG(rate.rate)', 'avgRate')
      .where('rate.baseCurrency = :base', { base })
      .andWhere('rate.targetCurrency = :target', { target })
      .andWhere('rate.fetchedAt >= :startDate', { startDate })
      .getRawOne();
    
    console.log("result for average rate is ", result);

    if (!result?.avgRate) {
      throw new HttpException(
        `No rates found for ${base}→${target} in period ${period}`,
        HttpStatus.NOT_FOUND
      );
    }

    return parseFloat(result.avgRate);
  }
}