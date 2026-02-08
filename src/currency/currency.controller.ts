import { Controller, Get, Post } from '@nestjs/common';
import { CurrencyService } from './currency.service';

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

    @Post('fetch')
    async fetchRates() {
        await this.currencyService.fetchAndSaveRates('USD');
        return { message: 'Rates fetched and saved successfully' };
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