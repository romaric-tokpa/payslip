import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { OrgResolutionService } from './org-resolution.service';

describe('OrgResolutionService', () => {
  const actor: RequestUser = {
    id: 'user-1',
    role: 'RH_ADMIN',
    companyId: 'comp-1',
    email: 'rh@test.fr',
  } as RequestUser;

  function serviceWithMocks(mocks: {
    directions?: { id: string; name: string }[];
    departments?: { id: string; name: string }[];
    services?: { id: string; name: string }[];
  }) {
    const prisma = {
      direction: {
        findMany: jest.fn().mockResolvedValue(mocks.directions ?? []),
      },
      department: {
        findMany: jest.fn().mockResolvedValue(mocks.departments ?? []),
      },
      service: {
        findMany: jest.fn().mockResolvedValue(mocks.services ?? []),
      },
    } as unknown as PrismaService;
    return new OrgResolutionService(prisma);
  }

  it('département existant → status existing', async () => {
    const svc = serviceWithMocks({
      departments: [{ id: 'd1', name: 'Ressources humaines' }],
    });
    const res = await svc.resolveOrg(actor, {
      directions: [],
      departments: ['Ressources humaines'],
      services: [],
      orgRows: [{ department: 'Ressources humaines' }],
    });
    expect(res.departments).toHaveLength(1);
    expect(res.departments[0].status).toBe('existing');
    expect(res.departments[0].existingId).toBe('d1');
  });

  it('département proche (fuzzy) → status similar', async () => {
    const svc = serviceWithMocks({
      departments: [{ id: 'd1', name: 'Comptabilité' }],
    });
    const res = await svc.resolveOrg(actor, {
      directions: [],
      departments: ['Comptabilté'],
      services: [],
      orgRows: [{ department: 'Comptabilté' }],
    });
    expect(res.departments[0].status).toBe('similar');
    expect(res.departments[0].suggestedId).toBe('d1');
    expect(res.departments[0].suggestedName).toBe('Comptabilité');
  });

  it('département inconnu → status new', async () => {
    const svc = serviceWithMocks({
      departments: [{ id: 'd1', name: 'RH' }],
    });
    const res = await svc.resolveOrg(actor, {
      directions: [],
      departments: ['Laboratoire quantique'],
      services: [],
      orgRows: [{ department: 'Laboratoire quantique' }],
    });
    expect(res.departments[0].status).toBe('new');
  });

  it('service new avec parent département dominant ≥ 80 %', async () => {
    const svc = serviceWithMocks({
      departments: [{ id: 'dep-x', name: 'Commercial' }],
      services: [],
    });
    const orgRows = Array.from({ length: 10 }, () => ({
      service: 'Vente terrain',
      department: 'Commercial',
    }));
    const res = await svc.resolveOrg(actor, {
      directions: [],
      departments: [],
      services: ['Vente terrain'],
      orgRows,
    });
    expect(res.services[0].status).toBe('new');
    expect(res.services[0].suggestedParentId).toBe('dep-x');
    expect(res.services[0].suggestedParentName).toBe('Commercial');
  });
});
