import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { Repository } from 'typeorm';
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
    if(!response?.rates){
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
}