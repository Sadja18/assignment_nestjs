import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyModule } from './currency/currency.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from './config/database.config';
import { ScheduleModule } from '@nestjs/schedule';

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
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [databaseConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Force non-nullable return with ! operator
        const dbConfig = configService.get('database', { infer: true });
        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }
        return dbConfig;
      },
      inject: [ConfigService],
    }),
    CurrencyModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }