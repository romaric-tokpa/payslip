import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class PayslipFileValidationPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Express.Multer.File
> {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Le fichier ne doit pas dépasser 10 Mo');
    }
    return file;
  }
}
