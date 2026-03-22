import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ProfilePhotoValidationPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Express.Multer.File
> {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException(
        'Formats acceptés : JPEG, PNG ou WebP (2 Mo max)',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('La photo ne doit pas dépasser 2 Mo');
    }
    return file;
  }
}
