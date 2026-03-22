import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DepartureService } from './departure.service';

@Injectable()
export class DepartureSchedulerService {
  private readonly logger = new Logger(DepartureSchedulerService.name);

  constructor(private readonly departureService: DepartureService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiredNotices(): Promise<void> {
    this.logger.log('Vérification des préavis expirés...');
    const count = await this.departureService.processExpiredNotices();
    if (count > 0) {
      this.logger.log(`${count} préavis expirés traités`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiredReadOnly(): Promise<void> {
    this.logger.log('Vérification des accès lecture seule expirés...');
    const count = await this.departureService.processExpiredReadOnly();
    if (count > 0) {
      this.logger.log(`${count} accès lecture seule expirés`);
    }
  }
}
