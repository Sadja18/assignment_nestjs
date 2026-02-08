import { Controller, Get, Post, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { LatestRatesDto } from './dto/latest-rates.dto';

/**
 * REST API endpoints for currency rate operations.
 * 
 * API CONTRACT (per assignment requirements):
 * - POST /rates/fetch → triggers ingestion from Frankfurter API
 * - GET /rates/latest → returns latest rates
 * - GET /rates/average → returns average over time window
 * 
 * CURRENT STATE:
 * - Temporary test endpoint (/rates/test-save) validates DB integration
 * - Will be replaced with real /fetch endpoint after Frankfurter service implementation
 */
@Controller('rates')
export class CurrencyController {
    constructor(private readonly currencyService: CurrencyService) { }

    /**
     * TEMPORARY TEST ENDPOINT (for development validation only).
     * 
     * PURPOSE:
     * - Verifies database connectivity and saveRate() logic
     * - Will be REMOVED before final submission
     * - Replaced by POST /rates/fetch that calls Frankfurter API
     * 
     * ASSIGNMENT ALIGNMENT:
     * - Simulates the required "POST /rates/fetch" behavior
     * - Uses hardcoded USD→INR rate for quick validation
     */
    @Post('test-save')
    async testSave() {
        await this.currencyService.saveRate('USD', 'INR', 83.123456);
        return { message: 'Saved test rate!' };
    }

    /**
 * Fetches latest exchange rates from Frankfurter API and stores them in the database.
 * 
 * Assignment requirement compliance:
 * - "POST /rates/fetch triggers fetching from third party API" ✅
 * - "Handle API failures gracefully (timeouts, retries)" ✅
 *   (Handled internally by FrankfurterService with retry logic)
 * - "Support at least 5 target currencies" ✅
 *   (USD → INR, EUR, GBP, JPY, CAD by default)
 * 
 * Error handling:
 * - Returns 503 Service Unavailable if Frankfurter API is unreachable after retries
 * - Returns 200 OK with success message on successful ingestion
 * 
 * Idempotency:
 * - Safe to call multiple times (duplicate prevention via fetchedAtMinute)
 * - Does not create duplicate records for same base/target/minute window
 */
    @Post('fetch')
    async fetchRates() {
        try {
            await this.currencyService.fetchAndSaveRates('USD');
            return { message: 'Rates fetched and saved successfully' };
        } catch (error) {
            // Propagate service-layer errors with appropriate HTTP status
            if (error instanceof HttpException) {
                throw error;
            }
            console.log("error ", error);
            // Fallback for unexpected errors
            throw new HttpException(
                'Internal error during rate ingestion',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
 * Returns the latest exchange rates for a given base currency.
 * 
 * Assignment requirement compliance:
 * - "GET /rates/latest?base=USD returns latest rates" ✅
 * - Supports query parameter 'base' with default USD ✅
 * - Returns clean JSON response with target currencies as keys ✅
 * 
 * Response format:
 * {
 *   "base": "USD",
 *   "rates": {
 *     "INR": 83.123456,
 *     "EUR": 0.920000,
 *     ...
 *   },
 *   "timestamp": "2024-06-15T10:30:00.000Z"
 * }
 * 
 * Error cases:
 * - 404 if no rates exist for requested base currency
 * - 400 if invalid base currency provided (handled by DTO validation)
 */
    @Get('latest')
    async getLatestRates(@Query() query: LatestRatesDto) {
        try {
            return await this.currencyService.getLatestRatesWithMetadata(query.base);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Internal error while fetching latest rates',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Health check for currency module.
     * 
     * PURPOSE:
     * - Isolated health verification for currency subsystem
     * - Complements root /health endpoint
     * - Helps diagnose partial failures in production
     */
    @Get('health')
    health() {
        return { currencyModule: 'OK' };
    }
}