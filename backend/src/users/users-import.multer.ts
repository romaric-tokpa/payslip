import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { IMPORT_ALLOWED_MIMES, IMPORT_MAX_BYTES } from './users-import.types';

function importFileExtension(originalname: string): string {
  const base = originalname.trim().toLowerCase();
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i) : '';
}

/**
 * Beaucoup de navigateurs envoient un .csv en text/plain ou octet-stream ; Windows peut
 * étiqueter du CSV en application/vnd.ms-excel. On s’appuie sur l’extension en secours.
 */
function isAllowedImportMime(file: Express.Multer.File): boolean {
  const allowed = IMPORT_ALLOWED_MIMES as readonly string[];
  if (allowed.includes(file.mimetype)) {
    return true;
  }
  const ext = importFileExtension(file.originalname);
  if (ext === '.csv') {
    return (
      file.mimetype === '' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/csv'
    );
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return file.mimetype === 'application/octet-stream';
  }
  return false;
}

export const importEmployeesMulterOptions: MulterOptions = {
  limits: { fileSize: IMPORT_MAX_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (isAllowedImportMime(file)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestException(
        `Fichier non accepté (type « ${file.mimetype} »). Utilisez un CSV ou Excel .xlsx / .xls.`,
      ),
      false,
    );
  },
};
