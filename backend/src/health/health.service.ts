import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { HealthResponse, HealthServices } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);
    const services: HealthServices = { database, redis, storage };
    const ok = this.isHealthy(services);
    return {
      status: ok ? 'ok' : 'error',
      timestamp,
      services,
    };
  }

  private isHealthy(services: HealthServices): boolean {
    if (services.database !== 'up' || services.storage !== 'up') {
      return false;
    }
    if (services.redis === 'down') {
      return false;
    }
    return true;
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkStorage(): Promise<'up' | 'down'> {
    try {
      await this.storage.pingBucket();
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down' | 'skipped'> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      return 'skipped';
    }
    let client: RedisClientType | undefined;
    try {
      client = createClient({ url });
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') {
        return 'down';
      }
      return 'up';
    } catch {
      return 'down';
    } finally {
      if (client?.isOpen) {
        try {
          await client.quit();
        } catch {
          try {
            await client.disconnect();
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}
