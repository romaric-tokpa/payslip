import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateDirectionDto } from './dto/create-direction.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDirectionDto } from './dto/update-direction.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type {
  OrgChartDepartmentNodeDto,
  OrgChartDirectionNodeDto,
  OrgChartEmployeeDto,
  OrgChartResponseDto,
  OrgChartServiceNodeDto,
} from './dto/org-chart.dto';
import type {
  OrgTreeDepartmentDto,
  OrgTreeDirectionDto,
  OrgTreeResponseDto,
  OrgTreeServiceDto,
} from './dto/org-tree.dto';
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from './org-tree.constants';

const departmentListSelect = {
  id: true,
  name: true,
  directionId: true,
  createdAt: true,
  updatedAt: true,
  direction: { select: { id: true, name: true } },
} as const;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRhWithCompany(actor: RequestUser): string {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
    return actor.companyId;
  }

  /**
   * Vérifie département + service pour un collaborateur de l’entreprise.
   * Si le service est rattaché à un département, le collaborateur doit avoir le même département.
   */
  async assertOrgAssignment(
    companyId: string,
    departmentId?: string | null,
    serviceId?: string | null,
  ): Promise<void> {
    if (departmentId) {
      const d = await this.prisma.department.findFirst({
        where: { id: departmentId, companyId },
        select: { id: true },
      });
      if (!d) {
        throw new BadRequestException('Département inconnu ou hors entreprise');
      }
    }
    if (serviceId) {
      const s = await this.prisma.service.findFirst({
        where: { id: serviceId, companyId },
        select: { id: true, departmentId: true },
      });
      if (!s) {
        throw new BadRequestException('Service inconnu ou hors entreprise');
      }
      if (s.departmentId != null) {
        if (departmentId !== s.departmentId) {
          throw new BadRequestException(
            'Ce service est rattaché à un département : le collaborateur doit être affecté au même département, ou choisir un service sans département.',
          );
        }
      }
    }
  }

  private async assertDirectionInCompany(
    directionId: string,
    companyId: string,
  ): Promise<void> {
    const dir = await this.prisma.direction.findFirst({
      where: { id: directionId, companyId },
      select: { id: true },
    });
    if (!dir) {
      throw new BadRequestException('Direction inconnue ou hors entreprise');
    }
  }

  async listDirections(actor: RequestUser) {
    const companyId = this.assertRhWithCompany(actor);
    return this.prisma.direction.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async createDirection(actor: RequestUser, dto: CreateDirectionDto) {
    const companyId = this.assertRhWithCompany(actor);
    const name = dto.name.trim();
    try {
      return await this.prisma.direction.create({
        data: { companyId, name },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Une direction porte déjà ce nom');
      }
      throw e;
    }
  }

  async updateDirection(
    actor: RequestUser,
    id: string,
    dto: UpdateDirectionDto,
  ) {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.direction.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Direction introuvable');
    }
    const name = dto.name.trim();
    try {
      return await this.prisma.direction.update({
        where: { id },
        data: { name },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Une direction porte déjà ce nom');
      }
      throw e;
    }
  }

  async deleteDirection(actor: RequestUser, id: string): Promise<void> {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.direction.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Direction introuvable');
    }
    await this.prisma.direction.delete({ where: { id } });
  }

  async listDepartments(actor: RequestUser) {
    const companyId = this.assertRhWithCompany(actor);
    return this.prisma.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: departmentListSelect,
    });
  }

  async createDepartment(actor: RequestUser, dto: CreateDepartmentDto) {
    const companyId = this.assertRhWithCompany(actor);
    const name = dto.name.trim();
    if (dto.directionId?.trim()) {
      await this.assertDirectionInCompany(dto.directionId.trim(), companyId);
    }
    const directionId = dto.directionId?.trim() ?? null;
    try {
      return await this.prisma.department.create({
        data: {
          companyId,
          name,
          directionId,
        },
        select: departmentListSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Un département porte déjà ce nom');
      }
      throw e;
    }
  }

  async updateDepartment(
    actor: RequestUser,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.department.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Département introuvable');
    }
    if (dto.name === undefined && dto.directionId === undefined) {
      throw new BadRequestException('Aucun champ à mettre à jour');
    }
    const data: Prisma.DepartmentUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.directionId !== undefined) {
      if (dto.directionId === null || dto.directionId === '') {
        data.direction = { disconnect: true };
      } else {
        await this.assertDirectionInCompany(dto.directionId, companyId);
        data.direction = { connect: { id: dto.directionId } };
      }
    }
    try {
      return await this.prisma.department.update({
        where: { id },
        data,
        select: departmentListSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Un département porte déjà ce nom');
      }
      throw e;
    }
  }

  async deleteDepartment(actor: RequestUser, id: string): Promise<void> {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.department.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Département introuvable');
    }
    await this.prisma.department.delete({ where: { id } });
  }

  async listServices(actor: RequestUser, departmentId?: string) {
    const companyId = this.assertRhWithCompany(actor);
    const where: Prisma.ServiceWhereInput = { companyId };
    if (departmentId === '__none__') {
      where.departmentId = null;
    } else if (departmentId?.trim()) {
      const d = await this.prisma.department.findFirst({
        where: { id: departmentId.trim(), companyId },
        select: { id: true },
      });
      if (!d) {
        throw new BadRequestException('Département inconnu');
      }
      where.departmentId = departmentId.trim();
    }
    return this.prisma.service.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  async createService(actor: RequestUser, dto: CreateServiceDto) {
    const companyId = this.assertRhWithCompany(actor);
    const name = dto.name.trim();
    let departmentId: string | null = null;
    if (dto.departmentId?.trim()) {
      const d = await this.prisma.department.findFirst({
        where: { id: dto.departmentId.trim(), companyId },
        select: { id: true },
      });
      if (!d) {
        throw new BadRequestException('Département inconnu ou hors entreprise');
      }
      departmentId = d.id;
    }
    return this.prisma.service.create({
      data: { companyId, name, departmentId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  async updateService(actor: RequestUser, id: string, dto: UpdateServiceDto) {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.service.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Service introuvable');
    }
    const name = dto.name.trim();
    let departmentId: string | null | undefined = undefined;
    if (dto.departmentId !== undefined) {
      if (dto.departmentId === null || dto.departmentId === '') {
        departmentId = null;
      } else {
        const d = await this.prisma.department.findFirst({
          where: { id: dto.departmentId, companyId },
          select: { id: true },
        });
        if (!d) {
          throw new BadRequestException(
            'Département inconnu ou hors entreprise',
          );
        }
        departmentId = d.id;
      }
    }
    const data: Prisma.ServiceUpdateInput = { name };
    if (departmentId !== undefined) {
      data.department =
        departmentId === null
          ? { disconnect: true }
          : { connect: { id: departmentId } };
    }
    return this.prisma.service.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  async deleteService(actor: RequestUser, id: string): Promise<void> {
    const companyId = this.assertRhWithCompany(actor);
    const existing = await this.prisma.service.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Service introuvable');
    }
    await this.prisma.service.delete({ where: { id } });
  }

  /**
   * Arbre direction → département → service avec effectifs (EMPLOYEE actifs, `groupBy`).
   */
  async getOrgTree(actor: RequestUser): Promise<OrgTreeResponseDto> {
    const companyId = this.assertRhWithCompany(actor);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      throw new NotFoundException('Entreprise introuvable');
    }

    const employeeWhere = {
      companyId,
      role: 'EMPLOYEE' as const,
      isActive: true,
    };

    const [
      totalEmployees,
      deptGroups,
      svcGroups,
      directionRows,
      departmentRows,
      serviceRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: employeeWhere }),
      this.prisma.user.groupBy({
        by: ['departmentId'],
        where: { ...employeeWhere, departmentId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['serviceId'],
        where: { ...employeeWhere, serviceId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.direction.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, directionId: true },
      }),
      this.prisma.service.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, departmentId: true },
      }),
    ]);

    const deptCountMap = new Map<string, number>();
    for (const g of deptGroups) {
      if (g.departmentId != null) {
        deptCountMap.set(g.departmentId, g._count._all);
      }
    }
    const svcCountMap = new Map<string, number>();
    for (const g of svcGroups) {
      if (g.serviceId != null) {
        svcCountMap.set(g.serviceId, g._count._all);
      }
    }

    const buildServices = (departmentId: string): OrgTreeServiceDto[] =>
      serviceRows
        .filter((s) => s.departmentId === departmentId)
        .map((s) => ({
          id: s.id,
          name: s.name,
          employeeCount: svcCountMap.get(s.id) ?? 0,
          departmentId,
        }));

    const buildDepartments = (
      directionId: string | null,
    ): OrgTreeDepartmentDto[] =>
      departmentRows
        .filter((d) =>
          directionId === null
            ? d.directionId == null
            : d.directionId === directionId,
        )
        .map((d) => ({
          id: d.id,
          name: d.name,
          employeeCount: deptCountMap.get(d.id) ?? 0,
          directionId: d.directionId,
          services: buildServices(d.id),
        }));

    const directionsFromDb: OrgTreeDirectionDto[] = directionRows.map(
      (dir) => {
        const departments = buildDepartments(dir.id);
        const employeeCount = departments.reduce(
          (acc, dep) => acc + dep.employeeCount,
          0,
        );
        return {
          id: dir.id,
          name: dir.name,
          employeeCount,
          departments,
        };
      },
    );

    const orphanDepartments = buildDepartments(null);
    const directions: OrgTreeDirectionDto[] =
      orphanDepartments.length > 0
        ? [
            ...directionsFromDb,
            {
              id: ORG_TREE_UNASSIGNED_DIRECTION_ID,
              name: 'Sans direction',
              employeeCount: orphanDepartments.reduce(
                (acc, d) => acc + d.employeeCount,
                0,
              ),
              departments: orphanDepartments,
            },
          ]
        : directionsFromDb;

    return {
      company: {
        id: company.id,
        name: company.name,
        totalEmployees,
      },
      directions,
    };
  }

  /**
   * Données hiérarchisées pour un organigramme (direction → département → service / collaborateurs).
   */
  async getOrgChart(actor: RequestUser): Promise<OrgChartResponseDto> {
    const companyId = this.assertRhWithCompany(actor);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const companyName = company?.name ?? 'Entreprise';

    const [directionRows, departmentRows, serviceRows, employeeRows] =
      await Promise.all([
        this.prisma.direction.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        this.prisma.department.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, directionId: true },
        }),
        this.prisma.service.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, departmentId: true },
        }),
        this.prisma.user.findMany({
          where: { companyId, role: 'EMPLOYEE', isActive: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            departmentId: true,
            serviceId: true,
            orgService: {
              select: { id: true, name: true, departmentId: true },
            },
          },
        }),
      ]);

    const svcById = new Map(serviceRows.map((s) => [s.id, s]));

    const toEmpDto = (e: (typeof employeeRows)[0]): OrgChartEmployeeDto => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      position: e.position,
      serviceName: e.orgService?.name ?? null,
    });

    const buildDepartmentNode = (deptId: string): OrgChartDepartmentNodeDto => {
      const dept = departmentRows.find((d) => d.id === deptId);
      if (!dept) {
        throw new NotFoundException('Département introuvable');
      }
      const deptServices = serviceRows.filter((s) => s.departmentId === deptId);
      const deptEmployees = employeeRows.filter(
        (e) => e.departmentId === deptId,
      );

      const services: OrgChartServiceNodeDto[] = deptServices.map((svc) => ({
        id: svc.id,
        name: svc.name,
        employees: deptEmployees
          .filter((e) => {
            if (!e.serviceId) {
              return false;
            }
            const s = svcById.get(e.serviceId);
            return s?.id === svc.id && s.departmentId === deptId;
          })
          .map(toEmpDto),
      }));

      const employees = deptEmployees
        .filter((e) => {
          if (!e.serviceId) {
            return true;
          }
          const s = svcById.get(e.serviceId);
          if (!s || s.departmentId !== deptId) {
            return true;
          }
          return false;
        })
        .map(toEmpDto);

      return {
        id: dept.id,
        name: dept.name,
        services,
        employees,
      };
    };

    const directions: OrgChartDirectionNodeDto[] = directionRows.map((dir) => ({
      id: dir.id,
      name: dir.name,
      departments: departmentRows
        .filter((d) => d.directionId === dir.id)
        .map((d) => buildDepartmentNode(d.id)),
    }));

    const departmentsWithoutDirection = departmentRows
      .filter((d) => d.directionId == null)
      .map((d) => buildDepartmentNode(d.id));

    const orphanServices = serviceRows
      .filter((s) => s.departmentId == null)
      .map((svc) => ({
        id: svc.id,
        name: svc.name,
        employees: employeeRows
          .filter((e) => e.serviceId === svc.id && e.departmentId == null)
          .map(toEmpDto),
      }));

    return {
      companyName,
      directions,
      departmentsWithoutDirection,
      orphanServices,
    };
  }
}
