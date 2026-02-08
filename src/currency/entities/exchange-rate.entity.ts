import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * ExchangeRate entity stores historical currency conversion rates.
 * 
 * DESIGN RATIONALE (per assignment requirements):
 * - Stores base_currency, target_currency, rate, and fetched_at timestamp
 * - Prevents duplicates via composite unique constraint on 
 *   (baseCurrency, targetCurrency, fetchedAtMinute)
 * - Uses SQLite-compatible types for rapid prototyping (migrates cleanly to PostgreSQL)
 * - Includes fetchedAtMinute for efficient deduplication without millisecond precision noise
 */
@Unique(['baseCurrency', 'targetCurrency', 'fetchedAtMinute'])
@Entity('exchange_rates')
export class ExchangeRate {
    /**
     * Auto-incremented primary key (required by TypeORM for SQLite).
     * Not used in business logic — exists only for ORM convenience.
     */
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * ISO 4217 currency code for the base currency (e.g., 'USD').
     * Length=3 enforces standard codes (assignment requires USD as base).
     */
    @Column({ length: 3 })
    baseCurrency: string;

    /**
     * ISO 4217 currency code for the target currency (e.g., 'INR', 'EUR').
     * Assignment requires support for at least 5 target currencies.
     */
    @Column({ length: 3 })
    targetCurrency: string;

    /**
     * Conversion rate from baseCurrency to targetCurrency.
     * Precision=15, scale=6 supports:
     * - High-value pairs (e.g., 1 USD = 150 JPY)
     * - Low-value pairs (e.g., 1 BTC = 0.00005 ETH)
     * Matches financial industry standards for rate storage.
     */
    @Column({ type: 'decimal', precision: 15, scale: 6 })
    rate: number;

    /**
     * Exact timestamp when rate was fetched from Frankfurter API.
     * 
     * TYPE CHOICE: 'datetime' (not 'timestamp') ensures compatibility with:
     * - SQLite (prototyping phase): Stores as ISO8601 string
     * - PostgreSQL (production): Maps to TIMESTAMP WITHOUT TIME ZONE
     * 
     * FUTURE UPGRADE: In PostgreSQL-only mode, could use 'timestamptz'
     * for timezone-aware storage — but unnecessary for this assignment's scope.
     */
    @Column({ type: 'timestamptz' })
    fetchedAt: Date;

    /**
     * Truncated timestamp (to minute precision) for duplicate prevention.
     * 
     * WHY MINUTE-GRANULARITY?
     * - Assignment states: "No duplicate records for same base, target, timestamp window"
     * - Frankfurter API updates rates ~once per day — minute window prevents accidental dupes
     *   during retries or concurrent cron runs
     * - Computed as: Math.floor(new Date().getTime() / 60_000)
     * 
     * CRITICAL: This enables the @Unique constraint to work reliably.
     */
    @Column({ type: 'int' })
    fetchedAtMinute: number;
}