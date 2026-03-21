import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { getRequestClientMeta } from '../common/utils/request-client.util';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestUser } from '../auth/auth.types';
import { Throttle } from '../common/decorators/throttle.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  BulkUploadReportDto,
  PayslipDetailResponseDto,
  PayslipResponseDto,
  PaginatedPayslipsResponseDto,
  UploadPayslipDto,
  QueryPayslipsDto,
} from './dto';
import { PayslipFileValidationPipe } from './pipes/payslip-file.pipe';
import {
  payslipBulkMulterOptions,
  payslipPdfMulterOptions,
} from './payslips-upload.multer';
import { PayslipsService } from './payslips.service';

@ApiTags('Payslips')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payslips')
export class PayslipsController {
  constructor(private readonly payslips: PayslipsService) {}

  @Throttle(20, 60)
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles('RH_ADMIN')
  @UseInterceptors(FileInterceptor('file', payslipPdfMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Téléverser un bulletin PDF (collaborateur + période)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'userId', 'periodMonth', 'periodYear'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier PDF (max 10 Mo)',
        },
        userId: { type: 'string', format: 'uuid' },
        periodMonth: { type: 'integer', minimum: 1, maximum: 12 },
        periodYear: { type: 'integer', minimum: 2020 },
      },
    },
  })
  @ApiCreatedResponse({ type: PayslipResponseDto })
  @ApiBadRequestResponse({
    description: 'PDF requis, type ou taille invalide, validation des champs',
  })
  @ApiForbiddenResponse({
    description: 'RH hors entreprise ou collaborateur hors périmètre',
  })
  @ApiConflictResponse({
    description: 'Bulletin déjà présent pour cette période',
  })
  @ApiUnauthorizedResponse()
  async upload(
    @UploadedFile(PayslipFileValidationPipe) file: Express.Multer.File,
    @Body() body: UploadPayslipDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payslips.uploadSingle(
      file,
      body.userId,
      body.periodMonth,
      body.periodYear,
      admin,
    );
  }

  @Throttle(20, 60)
  @Post('upload-bulk')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @UseInterceptors(FilesInterceptor('files', 500, payslipBulkMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Téléversement en masse',
    description:
      'Fichiers nommés MATRICULE_MM_AAAA.pdf (ex. EMP001_03_2024.pdf) ou forme compacte …MMYYYY.pdf (ex. EMP001032024.pdf). Jusqu’à 500 fichiers.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Liste de PDF (max 10 Mo chacun)',
        },
      },
    },
  })
  @ApiOkResponse({ type: BulkUploadReportDto })
  @ApiBadRequestResponse({ description: 'Requête invalide' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async uploadBulk(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payslips.uploadBulk(files ?? [], admin);
  }

  @Get()
  @Roles('RH_ADMIN', 'EMPLOYEE')
  @ApiOperation({
    summary: 'Lister les bulletins',
    description:
      'RH_ADMIN : toute l’entreprise, filtres optionnels userId, year, month. EMPLOYEE : ses bulletins uniquement.',
  })
  @ApiOkResponse({ type: PaginatedPayslipsResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async findAll(
    @Query() query: QueryPayslipsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.payslips.findAll(query, actor);
  }

  @Get(':id/download')
  @Roles('RH_ADMIN', 'EMPLOYEE')
  @ApiOperation({ summary: 'Redirection vers le PDF (URL présignée)' })
  @ApiFoundResponse({ description: 'Redirection 302 vers le fichier' })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: Response,
  ) {
    const url = await this.payslips.getDownloadUrl(id, actor);
    return res.redirect(HttpStatus.FOUND, url);
  }

  @Get(':id')
  @Roles('RH_ADMIN', 'EMPLOYEE')
  @ApiOperation({
    summary: 'Détail bulletin + URL de téléchargement temporaire',
  })
  @ApiOkResponse({ type: PayslipDetailResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.payslips.findOne(id, actor);
  }

  @Patch(':id/read')
  @Roles('EMPLOYEE')
  @ApiOperation({
    summary: 'Marquer le bulletin comme lu (titulaire uniquement)',
  })
  @ApiOkResponse({ type: PayslipResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
  ) {
    return this.payslips.markAsRead(id, actor, getRequestClientMeta(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Supprimer le bulletin (S3 + base), journal d’audit',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.payslips.remove(id, actor);
  }
}
