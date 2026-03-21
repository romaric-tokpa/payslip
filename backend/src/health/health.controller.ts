import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Santé des dépendances (DB, Redis optionnel, S3)' })
  @ApiResponse({ status: 200, description: 'Tous les services requis sont OK' })
  @ApiResponse({
    status: 503,
    description: 'Au moins un service requis est indisponible',
  })
  async getHealth(): Promise<HealthResponse> {
    const payload = await this.health.getHealth();
    if (payload.status !== 'ok') {
      throw new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return payload;
  }
}
