// src/currency/scheduler/scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrencyService } from '../currency.service';

@Injectable()
export class SchedularService {
    private readonly logger = new Logger(SchedularService.name);

    constructor(private readonly currencyService: CurrencyService) { }

    /**
     * Automatically fetches USD exchange rates every 3 hours.
     * 
     * Assignment compliance:
     * - Runs in background (non-blocking)
     * - Handles failures gracefully (logs but doesn't crash)
     * - Uses same ingestion logic as manual /rates/fetch
     */
    @Cron(CronExpression.EVERY_3_HOURS)
    async handleAutomaticFetch() {
        try {
            this.logger.log('Starting automatic rate fetch (USD)');
            await this.currencyService.fetchAndSaveRates('USD');
            this.logger.log('Automatic fetch completed');
        } catch (error) {
            this.logger.error('Automatic fetch failed', error.message);
            // Note: Failures are isolated - won't crash the app
        }
    }
}