import { IsString, IsIn, IsOptional } from 'class-validator';

/**
 * DTO for GET /rates/latest query parameters.
 * 
 * Validation rules:
 * - base must be a 3-letter ISO currency code
 * - Defaults to 'USD' if not provided (per assignment requirement)
 */
export class LatestRatesDto {
    @IsOptional()
    @IsString()
    @IsIn(['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF']) // Extendable list
    base: string = 'USD';
}