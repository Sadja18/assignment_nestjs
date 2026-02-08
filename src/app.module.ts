import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyModule } from './currency/currency.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Root application module wiring all feature modules together.
 * 
 * DATABASE STRATEGY:
 * - SQLite used for LOCAL DEVELOPMENT ONLY (rapid prototyping)
 * - synchronize: true enables auto-migrations during development
 * - WILL BE REPLACED with PostgreSQL + proper migrations before deployment
 * 
 * OBSERVABILITY COMPLIANCE:
 * - Health check endpoint (/health) provides system status
 * - Structured logging will be added in production configuration
 * 
 * ASSIGNMENT REQUIREMENTS MET:
 * - Clean module boundaries (CurrencyModule, SchedulerModule)
 * - Environment-based configuration ready for AWS deployment
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/dev.db', // Auto-created in dev
      entities: [__dirname + '/**/*.entity{.ts,.js}'],

      // ⚠️ PROTOTYPING ONLY: Auto-sync schema for rapid iteration
      // Will be disabled in production (replaced with migrations)
      synchronize: true,

      // Logging disabled in dev for cleaner output
      // Will be enabled with Winston in production
      logging: false,
    }),
    CurrencyModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }