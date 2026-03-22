import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/register (e2e)', () => {
  let app: import('@nestjs/common').INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `register-e2e-${suffix}@test.ci`;
  const companyName = `Register E2E Co ${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      const u = await prisma.user.findUnique({
        where: { email },
        select: { id: true, companyId: true },
      });
      if (u) {
        await prisma.auditLog.deleteMany({ where: { userId: u.id } });
        await prisma.session.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
        if (u.companyId) {
          await prisma.company.delete({ where: { id: u.companyId } }).catch(() => undefined);
        }
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('crée une entreprise + admin RH et retourne les jetons', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Aminata',
        lastName: 'Koné',
        referentJobTitle: 'Responsable des ressources humaines',
        email,
        password: 'SecureP@ss2026!',
        companyName,
        companyPhone: '+225 07 11 22 33 44',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role).toBe('RH_ADMIN');
    expect(res.body.user.companyName).toBe(companyName);
    expect(res.body.user.companyId).toBeDefined();
  });

  it('refuse un e-mail déjà utilisé', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Aminata',
        lastName: 'Koné',
        referentJobTitle: 'RH',
        email,
        password: 'SecureP@ss2026!',
        companyName: 'Autre Entreprise SARL',
        companyPhone: '+225 07 99 99 99 99',
      })
      .expect(409);
  });
});
