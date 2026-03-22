import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import type { RequestUser } from '../auth/auth.types';
import { InviteEmployeeDto } from '../auth/dto/invite-employee.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { Throttle } from '../common/decorators/throttle.decorator';
import {
  ArchiveDepartedUserDto,
  BulkActivateDto,
  BulkActivateResponseDto,
  BulkDepartureDto,
  CommitImportBodyDto,
  CreateUserDto,
  ImportResultDto,
  InitiateDepartureDto,
  QueryUsersDto,
  ReinstateDto,
  UpdateUserDto,
  UserResponseDto,
  ValidateImportBodyDto,
  ValidateImportResponseDto,
} from './dto';
import { UserImportConfigDto } from './dto/user-import-config.dto';
import { importEmployeesMulterOptions } from './users-import.multer';
import { ProfilePhotoValidationPipe } from './pipes/profile-photo-file.pipe';
import { profilePhotoMulterOptions } from './users-profile-photo.multer';
import { buildEmployeeImportTemplateXlsx } from './users-import-template.workbook';
import { DepartureService } from './departure.service';
import { UserImportJobService } from './user-import-job.service';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly importJobs: UserImportJobService,
    private readonly departure: DepartureService,
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
  ) {}

  private parseImportConfigOptional(
    importConfigRaw: string | undefined,
  ): UserImportConfigDto | undefined {
    if (importConfigRaw == null || String(importConfigRaw).trim() === '') {
      return undefined;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(importConfigRaw)) as unknown;
    } catch {
      throw new BadRequestException('importConfig : JSON invalide');
    }
    const dto = plainToInstance(UserImportConfigDto, parsed);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException('importConfig : données invalides');
    }
    return dto;
  }

  @Get()
  /** Kanban et rechargements admin enchaînent plusieurs pages : plafond plus haut que le défaut global. */
  @Throttle(1000, 60)
  @Roles('RH_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Liste paginée des collaborateurs',
    description:
      'RH_ADMIN : uniquement son entreprise. SUPER_ADMIN : tous les utilisateurs de la plateforme.',
  })
  @ApiOkResponse({
    description: 'Liste + métadonnées pagination',
    schema: {
      example: {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Rôle non autorisé' })
  async findAll(
    @Query() query: QueryUsersDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.findAllPaginated(actor, query);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Profil de l’utilisateur connecté',
    description:
      'Retourne les données publiques du compte et, si applicable, l’entreprise liée.',
  })
  @ApiOkResponse({ description: 'Utilisateur + entreprise' })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async getMe(@CurrentUser() actor: RequestUser) {
    return this.users.getMe(actor);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Mettre à jour le profil connecté',
    description:
      'Prénom, nom, e-mail, département et poste. L’e-mail doit rester unique sur la plateforme.',
  })
  @ApiOkResponse({
    description: 'Profil mis à jour (utilisateur + entreprise)',
  })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'E-mail déjà utilisé' })
  @ApiBadRequestResponse({ description: 'Validation des champs' })
  async updateMe(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.updateMe(actor, dto);
  }

  @Post('me/profile-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', profilePhotoMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Photo de profil (compte connecté)',
    description:
      'JPEG, PNG ou WebP, 2 Mo max. Remplace la photo existante ; visible côté RH sur la liste des collaborateurs.',
  })
  @ApiOkResponse({
    description: 'Profil mis à jour (utilisateur + entreprise)',
  })
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse({
    description: 'Fichier manquant ou type / taille invalide',
  })
  async uploadMeProfilePhoto(
    @CurrentUser() actor: RequestUser,
    @UploadedFile(new ProfilePhotoValidationPipe()) file: Express.Multer.File,
  ) {
    return this.users.uploadProfilePhoto(actor, file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Créer un collaborateur (code d’activation)',
    description:
      'Crée un compte EMPLOYEE inactif et un code d’activation à 6 chiffres (72 h), comme POST /auth/invite.',
  })
  @ApiCreatedResponse({
    description: 'Code d’activation (6 chiffres)',
    schema: {
      example: {
        activationCode: '482913',
        activationUrl: '/activate?code=482913',
      },
    },
  })
  @ApiConflictResponse({ description: 'E-mail ou matricule déjà utilisé' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() inviter: RequestUser,
  ) {
    return this.auth.inviteEmployee(dto as InviteEmployeeDto, inviter);
  }

  @Get('import/template')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Télécharger le modèle Excel d’import collaborateurs',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description:
      'Classeur .xlsx (onglets Collaborateurs + Instructions, validation e-mail)',
  })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async downloadImportTemplate(): Promise<StreamableFile> {
    const buffer = await buildEmployeeImportTemplateXlsx();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition:
        'attachment; filename="PaySlip_Manager_Import_Template.xlsx"',
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @UseInterceptors(FileInterceptor('file', importEmployeesMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import en masse (CSV ou Excel)',
    description:
      'Sans importConfig : détection automatique des colonnes. Avec importConfig (JSON string en multipart) : ' +
      'mappings { matricule, prenom?, nom?, email, departement?, service?, poste? } = noms exacts des colonnes du fichier ; ' +
      'splitFullName optionnel { column, separator: espace|virgule|tiret } ; rowIndices optionnel (indices 0-based). ' +
      'Une ligne en erreur n’empêche pas les autres.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier .csv, .xls ou .xlsx (max 5 Mo)',
        },
        importConfig: {
          type: 'string',
          description:
            'JSON stringifié : { mappings, splitFullName?, rowIndices? }',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Rapport d’import',
    schema: {
      example: {
        total: 10,
        created: 5,
        updated: 3,
        errors: 2,
        errorDetails: [
          {
            line: 3,
            matricule: 'EMP-1',
            reason:
              'E-mail déjà utilisé par un autre collaborateur (matricule différent)',
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fichier manquant, vide, trop volumineux ou format invalide',
  })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async importEmployees(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('importConfig') importConfigRaw: string | undefined,
    @CurrentUser() admin: RequestUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }
    const importConfig = this.parseImportConfigOptional(importConfigRaw);
    return this.users.importEmployees(file, admin, importConfig);
  }

  @Post('import/validate')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Valider un import collaborateurs (dry-run)',
    description:
      'Aucune écriture en base. Retourne un statut par ligne (prêt, mise à jour, erreur, avertissement).',
  })
  @ApiOkResponse({ type: ValidateImportResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async validateImport(
    @Body() body: ValidateImportBodyDto,
    @CurrentUser() admin: RequestUser,
  ): Promise<ValidateImportResponseDto> {
    return this.users.validateImportRows(admin, body.rows);
  }

  @Post('import/commit')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Importer des collaborateurs (JSON, après validation UI)',
    description:
      'Crée ou met à jour les lignes fournies. Rapport détaillé par ligne (créé, mis à jour, erreur).',
  })
  @ApiOkResponse({ type: ImportResultDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async commitImport(
    @Body() body: CommitImportBodyDto,
    @CurrentUser() admin: RequestUser,
  ): Promise<ImportResultDto> {
    return this.users.commitImportRows(admin, body.rows);
  }

  @Post('import/async')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('RH_ADMIN')
  @UseInterceptors(FileInterceptor('file', importEmployeesMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import en masse avec progression (SSE)',
    description:
      'Retourne immédiatement un jobId. Ouvrez GET /users/import/jobs/:jobId/events (flux SSE) pour la progression, puis le rapport final (événement done).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier .csv, .xls ou .xlsx (max 5 Mo)',
        },
        importConfig: {
          type: 'string',
          description:
            'JSON stringifié : { mappings, splitFullName?, rowIndices? }',
        },
      },
    },
  })
  @ApiAcceptedResponse({
    description: 'Identifiant de job pour le flux SSE',
    schema: { example: { jobId: '550e8400-e29b-41d4-a716-446655440000' } },
  })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  importEmployeesAsync(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('importConfig') importConfigRaw: string | undefined,
    @CurrentUser() admin: RequestUser,
  ): { jobId: string } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }
    const importConfig = this.parseImportConfigOptional(importConfigRaw);
    const jobId = this.importJobs.createJob(admin);
    void (async () => {
      try {
        const report = await this.users.importEmployees(
          file,
          admin,
          importConfig,
          {
            onEvent: (e) => this.importJobs.pushEvent(jobId, e),
          },
        );
        this.importJobs.finishSuccess(jobId, report);
      } catch (e) {
        this.importJobs.finishError(jobId, e);
      }
    })();
    return { jobId };
  }

  @Get('import/jobs/:jobId/events')
  @Sse()
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Flux SSE — progression import collaborateurs',
    description:
      'Événements JSON : parsing | start | progress | done | error. Authentification Bearer obligatoire.',
  })
  @ApiOkResponse({ description: 'text/event-stream' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Job inconnu ou expiré' })
  importJobEvents(
    @Param('jobId') jobId: string,
    @CurrentUser() user: RequestUser,
  ): Observable<MessageEvent> {
    return this.importJobs.stream(jobId, user);
  }

  @Get('activation/messaging-config')
  @Roles('RH_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Indique si l’envoi d’e-mails d’activation (SMTP) est configuré',
  })
  @ApiOkResponse({
    schema: { example: { smtpConfigured: true } },
  })
  activationMessagingConfig(): { smtpConfigured: boolean } {
    return { smtpConfigured: this.users.isActivationEmailConfigured() };
  }

  @Post('bulk-activate')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Activer et inviter des collaborateurs en masse',
    description:
      'Mot de passe temporaire, option e-mail / PDF / aucun envoi, liens WhatsApp optionnels.',
  })
  @ApiOkResponse({ type: BulkActivateResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  bulkActivate(
    @Body() dto: BulkActivateDto,
    @CurrentUser() admin: RequestUser,
  ): Promise<BulkActivateResponseDto> {
    return this.users.bulkActivate(admin, dto);
  }

  @Get('expiring-contracts')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Contrats CDD / intérim / stage à échéance' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async expiringContracts(
    @CurrentUser() admin: RequestUser,
    @Query('days') days?: string,
  ) {
    const n = days != null ? Number(days) : 30;
    const d = Number.isFinite(n) && n > 0 && n <= 366 ? Math.floor(n) : 30;
    return this.departure.getExpiringContracts(admin.companyId!, d);
  }

  @Post('bulk-depart')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Départ en masse' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  bulkDepart(
    @Body() dto: BulkDepartureDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.departure.bulkDepart(dto, admin.companyId!, admin.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Détail utilisateur',
    description:
      'RH_ADMIN : même entreprise uniquement. EMPLOYEE : son propre id uniquement. SUPER_ADMIN : tout utilisateur.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse({ description: 'Accès refusé à cet utilisateur' })
  @ApiUnauthorizedResponse()
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.findOneForActor(actor, id);
  }

  @Post(':id/invitation')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Régénérer le code d’activation (collaborateur inactif)',
    description:
      'Révoque les codes d’activation précédents et en émet un nouveau (72 h). ' +
      'À utiliser si le collaborateur a oublié le code — le clair n’est pas stocké en base.',
  })
  @ApiOkResponse({
    description: 'Nouveau code',
    schema: {
      example: {
        activationCode: '105742',
        activationUrl: '/activate?code=105742',
      },
    },
  })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description: 'Compte déjà activé ou rôle non collaborateur',
  })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async regenerateInvitation(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.auth.regenerateEmployeeInvitation(id, actor);
  }

  @Patch(':id/deactivate')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Désactiver un collaborateur (soft)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  @ApiBadRequestResponse({ description: 'Auto-désactivation interdite' })
  @ApiUnauthorizedResponse()
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.deactivateForRhAdmin(actor, id);
  }

  @Patch(':id/reactivate')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Réactiver un collaborateur' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async reactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.reactivateForRhAdmin(actor, id);
  }

  @Patch(':id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Mettre à jour un collaborateur' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse({ description: 'E-mail déjà utilisé' })
  @ApiUnauthorizedResponse()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.updateForRhAdmin(actor, id, dto);
  }

  @Post(':id/depart')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Enregistrer le départ d’un collaborateur' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async initiateDepart(
    @Param('id') id: string,
    @Body() dto: InitiateDepartureDto,
    @CurrentUser() admin: RequestUser,
  ) {
    await this.departure.initiateDepart(id, dto, admin.companyId!, admin.id);
    return this.users.findOneForActor(admin, id);
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Réintégrer un collaborateur sorti ou en préavis' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async reinstate(
    @Param('id') id: string,
    @Body() dto: ReinstateDto,
    @CurrentUser() admin: RequestUser,
  ) {
    await this.departure.reinstate(
      id,
      admin.companyId!,
      admin.id,
      dto.newContractEndDate,
    );
    return this.users.findOneForActor(admin, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Archiver un collaborateur DEPARTED (purge compte, bulletins conservés)',
  })
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async archiveDeparted(
    @Param('id') id: string,
    @Body() _dto: ArchiveDepartedUserDto,
    @CurrentUser() admin: RequestUser,
  ) {
    await this.departure.archiveDepartedUser(id, admin.companyId!, admin.id);
    return this.users.findOneForActor(admin, id);
  }
}
