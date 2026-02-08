import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { Logger } from '@nestjs/common';

/**
 * Service for fetching exchange rates from Frankfurter API (https://frankfurter.dev).
 * 
 * Requirements addressed:
 * - Fetches rates for base currency USD against at least 5 target currencies
 * - Handles API failures with retries and exponential backoff
 * - Enforces 5-second timeout per request
 * - Returns structured, validated rate data
 */
@Injectable()
export class FrankfurterService {
    private readonly logger = new Logger(FrankfurterService.name);
    private readonly baseUrl = 'https://api.frankfurter.app';
    private readonly defaultTargets = ['INR', 'EUR', 'GBP', 'JPY', 'CAD']; // 5+ currencies
    private readonly maxRetries = 3;
    private readonly requestTimeoutMs = 5000;

    constructor(private readonly httpService: HttpService) { }

    /**
     * Fetches latest exchange rates for a base currency.
     * 
     * Failure handling strategy:
     * - Retries up to 3 times with exponential backoff (1s, 2s, 4s)
     * - Times out after 5 seconds per attempt
     * - Throws HttpException(503) if all retries fail
     * 
     * @param base Base currency code (e.g., 'USD')
     * @param targets Target currency codes (defaults to 5 required currencies)
     * @returns Promise<{ date: string; rates: Record<string, number> }>
     */
    async fetchLatest(base: string = 'USD', targets: string[] = this.defaultTargets) {
        this.logger.debug('Fetching rates', 'FrankfurterService', { base, targets });
        const symbols = targets.join(',');

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.debug(`Fetching rates from Frankfurter (attempt ${attempt})`);

                const response$ = this.httpService.get(`${this.baseUrl}/latest`, {
                    params: { base, symbols },
                }).pipe(
                    timeout(this.requestTimeoutMs),
                    catchError((error) => {
                        this.logger.warn(`Frankfurter request failed (attempt ${attempt}): ${error.message}`);
                        return throwError(() => error);
                    })
                );

                const { data } = await firstValueFrom(response$);
                this.logger.log('Rates fetched successfully', 'FrankfurterService', {
                    base,
                    count: targets.length
                });
                return this.validateResponse(data);
            } catch (error) {
                const isLastAttempt = attempt === this.maxRetries;
                const delayMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s

                if (isLastAttempt) {
                    this.logger.error('All Frankfurter API attempts failed');
                    throw new HttpException(
                        'Failed to fetch exchange rates from upstream provider',
                        HttpStatus.SERVICE_UNAVAILABLE
                    );
                }

                this.logger.error('Fetch failed', 'FrankfurterService', error.stack, {
                    base,
                    error: error.message
                });
                await this.sleep(delayMs);
            }
        }
    }

    /**
     * Validates and sanitizes Frankfurter API response.
     * Ensures required fields exist and rates are numeric.
     */
    private validateResponse(data: any) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid Frankfurter API response structure');
        }

        const { date, rates } = data;
        if (!date || !rates || typeof rates !== 'object') {
            throw new Error('Missing date or rates in Frankfurter response');
        }

        // Ensure all target currencies have numeric rates
        const validatedRates: Record<string, number> = {};
        for (const [currency, rate] of Object.entries(rates)) {
            if (typeof rate !== 'number' || isNaN(rate)) {
                throw new Error(`Invalid rate value for ${currency}: ${rate}`);
            }
            validatedRates[currency] = Number(rate.toFixed(6)); // Enforce 6 decimal precision
        }

        return { date: data.date, rates: validatedRates };
    }

    /**
     * Helper to pause execution (for retry backoff).
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}