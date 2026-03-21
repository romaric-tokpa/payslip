import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { IMPORT_ALLOWED_MIMES, IMPORT_MAX_BYTES } from './users-import.types';

export const importEmployeesMulterOptions: MulterOptions = {
  limits: { fileSize: IMPORT_MAX_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowed = IMPORT_ALLOWED_MIMES as readonly string[];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new BadRequestException('Type MIME non autorisé'), false);
  },
};
