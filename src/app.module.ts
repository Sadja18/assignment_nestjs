import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyModule } from './currency/currency.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [CurrencyModule, SchedulerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
