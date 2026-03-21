import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRawUnsafe: jest.Mock };
  let storage: { pingBucket: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([1]) };
    storage = { pingBucket: jest.fn().mockResolvedValue(undefined) };

    const config = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? '' : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('retourne ok quand DB et S3 sont up et Redis ignoré', async () => {
    const r = await service.getHealth();
    expect(r.status).toBe('ok');
    expect(r.services.database).toBe('up');
    expect(r.services.storage).toBe('up');
    expect(r.services.redis).toBe('skipped');
  });

  it('retourne error si la base est down', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('econnrefused'));
    const r = await service.getHealth();
    expect(r.status).toBe('error');
    expect(r.services.database).toBe('down');
  });

  it('retourne error si le stockage est down', async () => {
    storage.pingBucket.mockRejectedValue(new Error('nosuchbucket'));
    const r = await service.getHealth();
    expect(r.status).toBe('error');
    expect(r.services.storage).toBe('down');
  });
});
