import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('RH_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Journal d’audit paginé',
    description:
      'RH_ADMIN : entrées dont l’utilisateur auteur appartient à la même entreprise. SUPER_ADMIN : toute la plateforme.',
  })
  @ApiOkResponse({
    description: 'Liste + pagination',
    schema: {
      example: {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Rôle non autorisé' })
  async list(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.audit.findAllPaginated(actor, query);
  }
}
