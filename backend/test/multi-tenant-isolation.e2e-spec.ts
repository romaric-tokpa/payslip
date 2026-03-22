import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Isolation multi-tenant : données réelles via Prisma + API HTTP.
 * Nécessite une base PostgreSQL joignable (comme les autres e2e).
 */
describe('Isolation multi-tenant (e2e)', () => {
  let app: import('@nestjs/common').INestApplication;
  let prisma: PrismaService;
  let companyAId: string;
  let companyBId: string;
  let rhAId: string;
  let rhBId: string;
  let empA1Id: string;
  let empA2Id: string;
  let empB1Id: string;
  let payslipAId: string;
  let payslipBId: string;
  /** Jetons réutilisés pour limiter les POST /auth/login (throttling global). */
  let tokenRhA: string;
  let tokenEmpA1: string;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const rhAEmail = `rh-a-${suffix}@isolation.test`;
  const rhBEmail = `rh-b-${suffix}@isolation.test`;
  const empA1Email = `emp-a1-${suffix}@isolation.test`;
  const empA2Email = `emp-a2-${suffix}@isolation.test`;
  const empB1Email = `emp-b1-${suffix}@isolation.test`;
  const password = 'TestIsolation123!';

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
    const hash = await bcrypt.hash(password, 12);

    const companyA = await prisma.company.create({
      data: { name: `Isolation Co A ${suffix}` },
    });
    const companyB = await prisma.company.create({
      data: { name: `Isolation Co B ${suffix}` },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const rhA = await prisma.user.create({
      data: {
        firstName: 'RH',
        lastName: 'Alpha',
        email: rhAEmail,
        passwordHash: hash,
        role: 'RH_ADMIN',
        companyId: companyAId,
        isActive: true,
        employmentStatus: 'ACTIVE',
      },
    });
    const rhB = await prisma.user.create({
      data: {
        firstName: 'RH',
        lastName: 'Beta',
        email: rhBEmail,
        passwordHash: hash,
        role: 'RH_ADMIN',
        companyId: companyBId,
        isActive: true,
        employmentStatus: 'ACTIVE',
      },
    });
    rhAId = rhA.id;
    rhBId = rhB.id;

    const empA1 = await prisma.user.create({
      data: {
        firstName: 'Emp',
        lastName: 'A1',
        email: empA1Email,
        passwordHash: hash,
        role: 'EMPLOYEE',
        companyId: companyAId,
        employeeId: `MT-A1-${suffix}`,
        isActive: true,
        employmentStatus: 'ACTIVE',
      },
    });
    const empA2 = await prisma.user.create({
      data: {
        firstName: 'Emp',
        lastName: 'A2',
        email: empA2Email,
        passwordHash: hash,
        role: 'EMPLOYEE',
        companyId: companyAId,
        employeeId: `MT-A2-${suffix}`,
        isActive: true,
        employmentStatus: 'ACTIVE',
      },
    });
    const empB1 = await prisma.user.create({
      data: {
        firstName: 'Emp',
        lastName: 'B1',
        email: empB1Email,
        passwordHash: hash,
        role: 'EMPLOYEE',
        companyId: companyBId,
        employeeId: `MT-B1-${suffix}`,
        isActive: true,
        employmentStatus: 'ACTIVE',
      },
    });
    empA1Id = empA1.id;
    empA2Id = empA2.id;
    empB1Id = empB1.id;

    const psA = await prisma.payslip.create({
      data: {
        userId: empA1Id,
        companyId: companyAId,
        periodMonth: 1,
        periodYear: 2024,
        fileUrl: `companies/${companyAId}/payslips/${empA1Id}/2024/01.pdf`,
        fileSize: 100,
        uploadedById: rhAId,
      },
    });
    const psB = await prisma.payslip.create({
      data: {
        userId: empB1Id,
        companyId: companyBId,
        periodMonth: 1,
        periodYear: 2024,
        fileUrl: `companies/${companyBId}/payslips/${empB1Id}/2024/01.pdf`,
        fileSize: 100,
        uploadedById: rhBId,
      },
    });
    payslipAId = psA.id;
    payslipBId = psB.id;

    const server = app.getHttpServer() as Server;
    const resA = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: rhAEmail, password });
    expect(resA.status).toBe(200);
    tokenRhA = resA.body.accessToken as string;

    const resE = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: empA1Email, password });
    expect(resE.status).toBe(200);
    tokenEmpA1 = resE.body.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.payslip.deleteMany({
        where: { id: { in: [payslipAId, payslipBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [rhAId, rhBId, empA1Id, empA2Id, empB1Id] } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [companyAId, companyBId] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it("RH_ADMIN de A ne voit que les collaborateurs de l'entreprise A", async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenRhA}`)
      .query({ limit: 100 });
    expect(res.status).toBe(200);
    const ids = new Set(
      (res.body.data as { id: string }[]).map((u: { id: string }) => u.id),
    );
    expect(ids.has(rhAId)).toBe(true);
    expect(ids.has(empA1Id)).toBe(true);
    expect(ids.has(empA2Id)).toBe(true);
    expect(ids.has(rhBId)).toBe(false);
    expect(ids.has(empB1Id)).toBe(false);
  });

  it('RH_ADMIN de A obtient 404 pour un utilisateur de B', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get(`/api/v1/users/${empB1Id}`)
      .set('Authorization', `Bearer ${tokenRhA}`);
    expect(res.status).toBe(404);
  });

  it("RH_ADMIN de A ne voit que les bulletins de l'entreprise A", async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v1/payslips')
      .set('Authorization', `Bearer ${tokenRhA}`)
      .query({ limit: 100 });
    expect(res.status).toBe(200);
    const ids = new Set(
      (res.body.data as { id: string }[]).map((p: { id: string }) => p.id),
    );
    expect(ids.has(payslipAId)).toBe(true);
    expect(ids.has(payslipBId)).toBe(false);
  });

  it('EMPLOYEE ne voit que ses propres bulletins', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v1/payslips')
      .set('Authorization', `Bearer ${tokenEmpA1}`)
      .query({ limit: 100 });
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: string }[]).map((p: { id: string }) => p.id);
    expect(ids).toContain(payslipAId);
    expect(ids).not.toContain(payslipBId);
    expect(ids.length).toBeGreaterThanOrEqual(1);
  });

  it('RH_ADMIN de A ne peut pas mettre à jour un utilisateur de B (404)', async () => {
    const res = await request(app.getHttpServer() as Server)
      .patch(`/api/v1/users/${empB1Id}`)
      .set('Authorization', `Bearer ${tokenRhA}`)
      .send({ firstName: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('RH_ADMIN de A ne peut pas téléverser un bulletin pour un collaborateur de B (404)', async () => {
    const pdf = Buffer.from('%PDF-1.4 minimal test');
    const res = await request(app.getHttpServer() as Server)
      .post('/api/v1/payslips/upload')
      .set('Authorization', `Bearer ${tokenRhA}`)
      .field('userId', empB1Id)
      .field('periodMonth', 2)
      .field('periodYear', 2024)
      .attach('file', pdf, 'test.pdf');
    expect(res.status).toBe(404);
  });
});
