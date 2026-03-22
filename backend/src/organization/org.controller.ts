import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateDirectionDto } from './dto/create-direction.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { OrgTreeResponseDto } from './dto/org-tree.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDirectionDto } from './dto/update-direction.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import {
  BulkCreateOrgDto,
  BulkCreateOrgResponseDto,
} from './dto/bulk-create-org.dto';
import { ResolveOrgDto, ResolveOrgResponseDto } from './dto/resolve-org.dto';
import { OrgResolutionService } from './org-resolution.service';
import { OrganizationService } from './organization.service';

@ApiTags('Org')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('org')
export class OrgController {
  constructor(
    private readonly organization: OrganizationService,
    private readonly orgResolution: OrgResolutionService,
  ) {}

  @Post('resolve')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Analyser directions / départements / services pour un import',
    description:
      'Compare le fichier aux entités existantes (exact, fuzzy Levenshtein ≤ 3, nouveau) et suggère des parents dominants (≥ 80 % des lignes).',
  })
  @ApiOkResponse({ type: ResolveOrgResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  resolveOrg(@CurrentUser() actor: RequestUser, @Body() dto: ResolveOrgDto) {
    return this.orgResolution.resolveOrg(actor, dto);
  }

  @Post('bulk-create')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Création en masse d’entités organisationnelles',
    description:
      'Transaction : directions, puis départements, puis services. Réutilise les existants en cas de doublon (nom normalisé).',
  })
  @ApiOkResponse({ type: BulkCreateOrgResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  bulkCreateOrg(
    @CurrentUser() actor: RequestUser,
    @Body() dto: BulkCreateOrgDto,
  ) {
    return this.orgResolution.bulkCreateOrg(actor, dto);
  }

  @Get('tree')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Arbre organisationnel avec effectifs',
    description:
      'Hiérarchie direction → département → service et comptages collaborateurs (EMPLOYEE actifs).',
  })
  @ApiOkResponse({ type: OrgTreeResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getTree(@CurrentUser() actor: RequestUser) {
    return this.organization.getOrgTree(actor);
  }

  @Post('directions')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Créer une direction' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  createDirection(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateDirectionDto,
  ) {
    return this.organization.createDirection(actor, dto);
  }

  @Patch('directions/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Modifier une direction' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateDirection(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDirectionDto,
  ) {
    return this.organization.updateDirection(actor, id, dto);
  }

  @Delete('directions/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Supprimer une direction' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteDirection(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organization.deleteDirection(actor, id);
  }

  @Post('departments')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Créer un département' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  createDepartment(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.organization.createDepartment(actor, dto);
  }

  @Patch('departments/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Modifier un département' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateDepartment(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.organization.updateDepartment(actor, id, dto);
  }

  @Delete('departments/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Supprimer un département' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteDepartment(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organization.deleteDepartment(actor, id);
  }

  @Post('services')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Créer un service' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  createService(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateServiceDto,
  ) {
    return this.organization.createService(actor, dto);
  }

  @Patch('services/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Modifier un service' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateService(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.organization.updateService(actor, id, dto);
  }

  @Delete('services/:id')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Supprimer un service' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteService(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organization.deleteService(actor, id);
  }
}
