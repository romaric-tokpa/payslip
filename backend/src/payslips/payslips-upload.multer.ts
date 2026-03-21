import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const TEN_MB = 10 * 1024 * 1024;

export const payslipPdfMulterOptions: MulterOptions = {
  limits: { fileSize: TEN_MB },
};

export const payslipBulkMulterOptions: MulterOptions = {
  limits: { fileSize: TEN_MB },
};
