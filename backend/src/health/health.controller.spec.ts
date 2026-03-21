import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.types';

describe('HealthController', () => {
  let controller: HealthController;
  let service: { getHealth: jest.Mock };

  beforeEach(async () => {
    service = { getHealth: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: service }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('retourne le payload si status ok', async () => {
    const payload: HealthResponse = {
      status: 'ok',
      timestamp: '2020-01-01T00:00:00.000Z',
      services: {
        database: 'up',
        redis: 'skipped',
        storage: 'up',
      },
    };
    service.getHealth.mockResolvedValue(payload);
    await expect(controller.getHealth()).resolves.toEqual(payload);
  });

  it('lève HttpException 503 si status error', async () => {
    const payload: HealthResponse = {
      status: 'error',
      timestamp: '2020-01-01T00:00:00.000Z',
      services: {
        database: 'down',
        redis: 'skipped',
        storage: 'up',
      },
    };
    service.getHealth.mockResolvedValue(payload);
    try {
      await controller.getHealth();
      throw new Error('devrait lever HttpException');
    } catch (e) {
      if (e instanceof Error && e.message === 'devrait lever HttpException') {
        throw e;
      }
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect((e as HttpException).getResponse()).toEqual(payload);
    }
  });
});
