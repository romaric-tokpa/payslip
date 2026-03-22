import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { DashboardService } from './dashboard.service';
import { DashboardStatsResponseDto } from './dto/dashboard-stats.dto';
import { RemindUnreadResponseDto } from './dto/enhanced-dashboard.dto';

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
    description:
      'Périmètre : entreprise du RH connecté. Sans paramètre : mois civil UTC courant. ?year=2025 : agrégat sur toute l’année civile UTC. ?year=2025&month=3 : mois de paie mars 2025.',
  })
  @ApiOkResponse({ type: DashboardStatsResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async getStats(
    @CurrentUser() actor: RequestUser,
    @Query('month') monthRaw?: string,
    @Query('year') yearRaw?: string,
  ) {
    if (monthRaw === undefined && yearRaw === undefined) {
      return this.dashboard.getStats(actor);
    }
    if (yearRaw === undefined) {
      throw new BadRequestException(
        'year est requis (2000–2100) lorsque month est fourni.',
      );
    }
    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year doit être un entier entre 2000 et 2100.');
    }
    if (monthRaw === undefined || monthRaw === '') {
      return this.dashboard.getStats(actor, { year });
    }
    const month = Number(monthRaw);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month doit être un entier entre 1 et 12.');
    }
    return this.dashboard.getStats(actor, { year, month });
  }

  @Post('remind-unread')
  @HttpCode(HttpStatus.OK)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Relancer les collaborateurs sans consultation (mois courant)',
    description:
      'Crée une notification in-app par personne concernée (bulletin du mois civil UTC non lu).',
  })
  @ApiOkResponse({ type: RemindUnreadResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async remindUnread(@CurrentUser() actor: RequestUser) {
    return this.dashboard.remindUnreadCurrentMonth(actor);
  }
}
