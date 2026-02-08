import { Module } from '@nestjs/common';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { FrankfurterService } from './frankfurter/frankfurter.service';
import { HttpModule } from '@nestjs/axios';
import { SchedularService } from './schedular/schedular.service';

/**
 * Feature module encapsulating all currency-related functionality.
 * 
 * ARCHITECTURE BENEFITS:
 * - Encapsulation: All currency logic isolated in one module
 * - Dependency injection: Service/repository wiring handled automatically
 * - Testability: Can be unit-tested independently
 * - Scalability: New currency features (e.g., alerts, conversions) can be added here
 * 
 * DEPENDENCIES:
 * - TypeOrmModule.forFeature([ExchangeRate]): Provides ExchangeRate repository
 * - CurrencyService: Business logic provider
 * - CurrencyController: API facade
 */
@Module({
  imports: [
    HttpModule, // required for FrankFurterService
    TypeOrmModule.forFeature([ExchangeRate])
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService, FrankfurterService, SchedularService],
})
export class CurrencyModule { }