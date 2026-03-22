import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const profilePhotoMulterOptions: MulterOptions = {
  limits: { fileSize: MAX_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestException(
        `Fichier non accepté (type « ${file.mimetype} »). Utilisez JPEG, PNG ou WebP.`,
      ),
      false,
    );
  },
};
