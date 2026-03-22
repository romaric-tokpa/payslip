import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { PayslipFileValidationPipe } from './pipes/payslip-file.pipe';
import { PayslipBulkTempStore } from './payslip-bulk-temp.store';
import { PayslipMatcherService } from './payslip-matcher.service';
import { PayslipPdfExtractorService } from './payslip-pdf-extractor.service';
import { PayslipSignatureService } from './payslip-signature.service';
import { PayslipsController } from './payslips.controller';
import { PayslipsService } from './payslips.service';

@Module({
  imports: [PrismaModule, StorageModule, UsersModule, NotificationsModule],
  controllers: [PayslipsController],
  providers: [
    PayslipSignatureService,
    PayslipsService,
    PayslipFileValidationPipe,
    PayslipPdfExtractorService,
    PayslipMatcherService,
    PayslipBulkTempStore,
  ],
  exports: [PayslipsService],
})
export class PayslipsModule {}
