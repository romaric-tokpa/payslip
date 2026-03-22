import {
  Body,
  Controller,
  Delete,
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
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDirectionDto } from './dto/update-direction.dto';
import { OrgChartResponseDto } from './dto/org-chart.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { OrganizationService } from './organization.service';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('chart')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Données pour organigramme',
    description:
      'Hiérarchie direction → département → services et collaborateurs actifs (EMPLOYEE).',
  })
  @ApiOkResponse({ type: OrgChartResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getOrgChart(@CurrentUser() actor: RequestUser) {
    return this.organization.getOrgChart(actor);
  }

  @Get('directions')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Liste des directions de mon entreprise' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listDirections(@CurrentUser() actor: RequestUser) {
    return this.organization.listDirections(actor);
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
  @ApiOperation({ summary: 'Renommer une direction' })
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
  @ApiOperation({
    summary: 'Supprimer une direction',
    description:
      'Les départements rattachés perdent leur direction (ON DELETE SET NULL).',
  })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteDirection(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organization.deleteDirection(actor, id);
  }

  @Get('departments')
  @Roles('RH_ADMIN')
  @ApiOperation({ summary: 'Liste des départements de mon entreprise' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listDepartments(@CurrentUser() actor: RequestUser) {
    return this.organization.listDepartments(actor);
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
  @ApiOperation({
    summary: 'Modifier un département',
    description:
      'Nom et/ou direction parente (`directionId` : `null` = sans direction).',
  })
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
  @ApiOperation({
    summary: 'Supprimer un département',
    description:
      'Les services liés perdent le rattachement au département ; les collaborateurs perdent leur affectation à ce département (contraintes ON DELETE SET NULL).',
  })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteDepartment(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organization.deleteDepartment(actor, id);
  }

  @Get('services')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Liste des services',
    description:
      'Filtre optionnel `departmentId` : UUID du département, ou `__none__` pour les services sans département.',
  })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listServices(
    @CurrentUser() actor: RequestUser,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.organization.listServices(actor, departmentId);
  }

  @Post('services')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Créer un service (optionnellement rattaché à un département)',
  })
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
