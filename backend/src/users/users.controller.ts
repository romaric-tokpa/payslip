import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
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
import { AuthService } from '../auth/auth.service';
import type { RequestUser } from '../auth/auth.types';
import { InviteEmployeeDto } from '../auth/dto/invite-employee.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto';
import { importEmployeesMulterOptions } from './users-import.multer';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
  ) {}

  @Get()
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Créer un collaborateur (invitation)',
    description:
      'Crée un compte EMPLOYEE inactif et un jeton d’invitation (72 h), comme POST /auth/invite.',
  })
  @ApiCreatedResponse({
    description: 'Jeton d’invitation',
    schema: {
      example: {
        invitationToken: 'uuid',
        invitationUrl: '/activate?token=uuid',
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
    summary: 'Télécharger le modèle CSV d’import collaborateurs',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Fichier CSV avec en-têtes + ligne d’exemple' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  downloadImportTemplate(): StreamableFile {
    return new StreamableFile(
      Buffer.from(UsersService.importTemplateCsv, 'utf-8'),
      {
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment; filename="import_template.csv"',
      },
    );
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @UseInterceptors(FileInterceptor('file', importEmployeesMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import en masse (CSV ou Excel)',
    description:
      'Colonnes : matricule, prenom, nom, email, departement, poste. Une ligne en erreur n’empêche pas les autres.',
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
      },
    },
  })
  @ApiOkResponse({
    description: 'Rapport d’import',
    schema: {
      example: {
        total: 10,
        created: 8,
        errors: 2,
        errorDetails: [
          { line: 3, matricule: 'EMP-1', reason: 'E-mail déjà utilisé' },
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
    @CurrentUser() admin: RequestUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }
    return this.users.importEmployees(file, admin);
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
}
