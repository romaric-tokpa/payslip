import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { Public } from '../auth/decorators/public.decorator';
import {
  BulkAnalyzeResponseDto,
  BulkUploadReportDto,
  ConfirmBulkDto,
  PayslipDetailResponseDto,
  PayslipResponseDto,
  PaginatedPayslipsResponseDto,
  PayslipSignaturePeriodQueryDto,
  RemindPayslipSignaturesDto,
  UploadPayslipDto,
  QueryPayslipsDto,
} from './dto';
import { PayslipFileValidationPipe } from './pipes/payslip-file.pipe';
import {
  payslipBulkMulterOptions,
  payslipPdfMulterOptions,
} from './payslips-upload.multer';
import { PayslipSignatureService } from './payslip-signature.service';
import { PayslipsService } from './payslips.service';

@ApiTags('Payslips')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payslips')
export class PayslipsController {
  constructor(
    private readonly payslips: PayslipsService,
    private readonly signatures: PayslipSignatureService,
  ) {}

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

  @Throttle(20, 60)
  @Post('analyze-bulk')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @UseInterceptors(FilesInterceptor('files', 500, payslipBulkMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyser un lot de bulletins PDF',
    description:
      'Extraction du texte, détection matricule / nom / période et matching collaborateur. Les fichiers sont conservés 30 minutes pour confirmation (confirm-bulk). Aucun envoi S3 ni écriture bulletin.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({ type: BulkAnalyzeResponseDto })
  @ApiBadRequestResponse({ description: 'Requête invalide' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async analyzeBulk(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payslips.analyzeBulk(files ?? [], admin);
  }

  @Throttle(20, 60)
  @Post('confirm-bulk')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Confirmer et téléverser un lot analysé',
    description:
      'Utilise le batchId renvoyé par analyze-bulk et les affectations corrigées par le RH. Upload S3 + création bulletin + notifications.',
  })
  @ApiOkResponse({ type: BulkUploadReportDto })
  @ApiBadRequestResponse({ description: 'Lot expiré ou payload invalide' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async confirmBulk(
    @Body() body: ConfirmBulkDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payslips.confirmBulk(body, admin);
  }

  @Throttle(30, 60)
  @Post(':id/sign')
  @HttpCode(HttpStatus.CREATED)
  @Roles('EMPLOYEE')
  @ApiOperation({
    summary: 'Accusé de réception électronique du bulletin (collaborateur)',
  })
  @ApiCreatedResponse({ description: 'Enregistrement de la signature' })
  async signPayslip(
    @Param('id', ParseUUIDPipe) payslipId: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    const meta = getRequestClientMeta(req);
    const deviceRaw = req.headers['x-device-info'];
    const deviceInfo =
      typeof deviceRaw === 'string' ? deviceRaw : undefined;
    return this.signatures.signPayslip(payslipId, user.id, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceInfo,
    });
  }

  @Throttle(40, 60)
  @Public()
  @Get('signatures/verify/:code')
  @ApiOperation({
    summary: 'Vérifier un accusé de réception (public, tiers / inspection)',
  })
  async verifySignature(@Param('code') code: string) {
    return this.signatures.verifySignature(code);
  }

  @Get('signatures/stats')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Statistiques de signature pour une période' })
  async getSignatureStats(
    @CurrentUser() admin: RequestUser,
    @Query() q: PayslipSignaturePeriodQueryDto,
  ) {
    if (!admin.companyId) {
      throw new ForbiddenException();
    }
    return this.signatures.getSignatureStats(
      admin.companyId,
      q.month,
      q.year,
    );
  }

  @Get('signatures/unsigned')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Bulletins non signés (relance RH)' })
  async getUnsignedPayslips(
    @CurrentUser() admin: RequestUser,
    @Query() q: PayslipSignaturePeriodQueryDto,
  ) {
    if (!admin.companyId) {
      throw new ForbiddenException();
    }
    return this.signatures.getUnsignedPayslips(
      admin.companyId,
      q.month,
      q.year,
    );
  }

  @Get('signatures/export')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Exporter le rapport de conformité (CSV)' })
  async exportSignatureReport(
    @CurrentUser() admin: RequestUser,
    @Query() q: PayslipSignaturePeriodQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!admin.companyId) {
      throw new ForbiddenException();
    }
    const csv = await this.signatures.exportComplianceCsv(
      admin.companyId,
      q.month,
      q.year,
    );
    const fn = `rapport-signatures-${q.year}-${String(q.month).padStart(2, '0')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fn}"; filename*=UTF-8''${encodeURIComponent(fn)}`,
    );
    res.send(`\uFEFF${csv}`);
  }

  @Get('signatures/:signatureId/certificate')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Télécharger le certificat PDF de signature' })
  async downloadCertificate(
    @Param('signatureId', ParseUUIDPipe) signatureId: string,
    @CurrentUser() admin: RequestUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!admin.companyId) {
      throw new ForbiddenException();
    }
    const pdf = await this.signatures.generateSignatureCertificate(
      signatureId,
      admin.companyId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'attachment; filename="certificat-signature.pdf"',
    });
    res.send(pdf);
  }

  @Post('signatures/remind')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Notifier les collaborateurs sans signature' })
  async remindUnsigned(
    @CurrentUser() admin: RequestUser,
    @Body() dto: RemindPayslipSignaturesDto,
  ) {
    if (!admin.companyId) {
      throw new ForbiddenException();
    }
    return this.signatures.remindUnsigned(
      admin.companyId,
      {
        month: dto.month,
        year: dto.year,
        message: dto.message,
        userIds: dto.userIds,
      },
      admin.id,
    );
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
  @Roles('RH_ADMIN', 'EMPLOYEE')
  @ApiOperation({
    summary: 'Marquer le bulletin comme lu',
    description:
      'EMPLOYEE : son bulletin uniquement. RH_ADMIN : bulletin d’un collaborateur de son entreprise (sans entrée d’audit « lecture »).',
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
