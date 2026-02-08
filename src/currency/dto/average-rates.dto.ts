import { IsString, IsIn, Matches } from 'class-validator';

export class AverageRatesDto {
    @IsString()
    @IsIn(['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD'])
    base: string;

    @IsString()
    @IsIn(['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD'])
    target: string;

    @IsString()
    @Matches(/^(1h|6h|12h|24h|7d)$/) // Supported periods
    period: string = '24h';
}