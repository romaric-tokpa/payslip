import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { PayslipFileValidationPipe } from './pipes/payslip-file.pipe';
import { PayslipsController } from './payslips.controller';
import { PayslipsService } from './payslips.service';

@Module({
  imports: [PrismaModule, StorageModule, UsersModule, NotificationsModule],
  controllers: [PayslipsController],
  providers: [PayslipsService, PayslipFileValidationPipe],
  exports: [PayslipsService],
})
export class PayslipsModule {}
