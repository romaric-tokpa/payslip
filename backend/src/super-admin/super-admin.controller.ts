import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SuperAdminAuditQueryDto } from './dto/super-admin-audit-query.dto';
import { SuperAdminCompaniesQueryDto } from './dto/super-admin-companies-query.dto';
import { SuperAdminUpdateCompanyDto } from './dto/super-admin-update-company.dto';
import { SuperAdminService } from './super-admin.service';

@ApiTags('super-admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private readonly superAdmin: SuperAdminService,
    private readonly auth: AuthService,
  ) {}

  @Get('stats')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Statistiques globales plateforme' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getStats() {
    return this.superAdmin.getPlatformStats();
  }

  @Get('companies')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Liste des entreprises clientes' })
  @ApiOkResponse()
  getCompanies(@Query() query: SuperAdminCompaniesQueryDto) {
    return this.superAdmin.getCompanies(query);
  }

  @Get('companies/recent')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '5 dernières entreprises inscrites' })
  getRecentCompanies() {
    return this.superAdmin.getRecentCompanies(5);
  }

  @Get('companies/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Détail entreprise' })
  @ApiNotFoundResponse()
  getCompanyDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.superAdmin.getCompanyDetail(id);
  }

  @Patch('companies/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Mettre à jour une entreprise (plan, nom, actif)' })
  @ApiNotFoundResponse()
  updateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuperAdminUpdateCompanyDto,
  ) {
    return this.superAdmin.updateCompany(id, dto);
  }

  @Post('companies/:id/impersonate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Obtenir une session en tant que RH_ADMIN principal',
    description:
      'Jeton d’accès 1h avec claim impersonatedBy ; action journalisée.',
  })
  impersonate(
    @Param('id', ParseUUIDPipe) companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.auth.impersonateCompanyRh(actor, companyId);
  }

  @Get('audit')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Journal d’audit global' })
  getAudit(@Query() query: SuperAdminAuditQueryDto) {
    return this.superAdmin.getGlobalAuditLogs(query);
  }

  @Get('growth')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Données agrégées de croissance' })
  getGrowth() {
    return this.superAdmin.getGrowthData();
  }
}