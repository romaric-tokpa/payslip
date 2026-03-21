import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { DashboardService } from './dashboard.service';
import { DashboardStatsResponseDto } from './dto/dashboard-stats.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Indicateurs RH pour le tableau de bord',
    description: 'Périmètre : entreprise du RH connecté.',
  })
  @ApiOkResponse({ type: DashboardStatsResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async getStats(@CurrentUser() actor: RequestUser) {
    return this.dashboard.getStats(actor);
  }
}
