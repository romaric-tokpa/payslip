import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { CompaniesService } from './companies.service';
import { UpdateCompanyMeDto } from './dto/update-company-me.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Patch('me')
  @Roles('RH_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Mettre à jour les informations légales de mon entreprise',
    description:
      'Raison sociale, RCCM, adresse. Réservé aux comptes RH ou super admin rattachés à une entreprise (`companyId`).',
  })
  @ApiOkResponse({ description: 'Profil utilisateur + entreprise à jour' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Rôle non autorisé' })
  @ApiBadRequestResponse({
    description: 'Aucune entreprise rattachée ou corps vide / invalide',
  })
  async updateMyCompany(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateCompanyMeDto,
  ) {
    return this.companies.updateMyCompany(actor, dto);
  }
}
