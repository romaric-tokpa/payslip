import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { isEmail } from 'class-validator';
import type { RequestUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userPublicSelect, type UserPublic } from './dto/user-public.select';
import { USER_AUDIT } from './users.constants';
import {
  IMPORT_ALLOWED_MIMES,
  IMPORT_MAX_BYTES,
  type ImportEmployeesReport,
} from './users-import.types';
import {
  extractImportFields,
  parseCsvBuffer,
  parseXlsxBuffer,
} from './users-import.parse';

export type PaginatedUsers = {
  data: UserPublic[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CompanyBrief = {
  id: string;
  name: string;
  rccm: string | null;
  address: string | null;
};

export type MeResponse = {
  user: UserPublic;
  company: CompanyBrief | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organization: OrganizationService,
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Résolution matricule → utilisateur dans une entreprise (import / bulletins). */
  findByCompanyAndEmployeeId(
    companyId: string,
    employeeId: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { companyId, employeeId },
    });
  }

  emailTaken(email: string): Promise<boolean> {
    return this.prisma.user
      .findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      })
      .then((u) => !!u);
  }

  isRhAdmin(role: UserRole): boolean {
    return role === 'RH_ADMIN';
  }

  async getMe(actor: RequestUser): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: userPublicSelect,
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    let company: CompanyBrief | null = null;
    if (user.companyId) {
      company = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: {
          id: true,
          name: true,
          rccm: true,
          address: true,
        },
      });
    }
    return { user, company };
  }

  async updateMe(actor: RequestUser, dto: UpdateUserDto): Promise<MeResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase();
      const taken = await this.prisma.user.findFirst({
        where: { email, NOT: { id: actor.id } },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException('Cet e-mail est déjà utilisé');
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return this.getMe(actor);
    }

    await this.prisma.user.update({
      where: { id: actor.id },
      data,
    });
    return this.getMe(actor);
  }

  async findAllPaginated(
    actor: RequestUser,
    query: QueryUsersDto,
  ): Promise<PaginatedUsers> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildListWhere(actor, query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userPublicSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private buildListWhere(
    actor: RequestUser,
    query: QueryUsersDto,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId) {
        throw new ForbiddenException('Compte sans entreprise associée');
      }
      where.companyId = actor.companyId;
    }

    if (query.department?.trim()) {
      where.department = query.department.trim();
    }

    if (query.departmentId?.trim()) {
      where.departmentId = query.departmentId.trim();
    }

    if (query.directionId?.trim()) {
      where.orgDepartment = {
        directionId: query.directionId.trim(),
      };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { employeeId: { contains: s, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findOneForActor(actor: RequestUser, id: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userPublicSelect,
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (actor.role === 'EMPLOYEE') {
      if (actor.id !== id) {
        throw new ForbiddenException();
      }
      return user;
    }

    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId || user.companyId !== actor.companyId) {
        throw new ForbiddenException();
      }
      return user;
    }

    if (actor.role === 'SUPER_ADMIN') {
      return user;
    }

    throw new ForbiddenException();
  }

  async updateForRhAdmin(
    actor: RequestUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserPublic> {
    this.assertRhAdminWithCompany(actor);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (existing.companyId !== actor.companyId) {
      throw new ForbiddenException();
    }

    const resolvedDepartmentId =
      dto.departmentId !== undefined
        ? dto.departmentId
        : existing.departmentId;
    const resolvedServiceId =
      dto.serviceId !== undefined ? dto.serviceId : existing.serviceId;

    if (dto.departmentId !== undefined || dto.serviceId !== undefined) {
      await this.organization.assertOrgAssignment(
        actor.companyId!,
        resolvedDepartmentId,
        resolvedServiceId,
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.departmentId !== undefined) {
      data.orgDepartment =
        dto.departmentId === null
          ? { disconnect: true }
          : { connect: { id: dto.departmentId } };
      if (dto.departmentId) {
        const d = await this.prisma.department.findFirst({
          where: { id: dto.departmentId, companyId: actor.companyId! },
          select: { name: true },
        });
        if (d) {
          data.department = d.name;
        }
      } else {
        data.department = null;
      }
    }
    if (dto.serviceId !== undefined) {
      data.orgService =
        dto.serviceId === null
          ? { disconnect: true }
          : { connect: { id: dto.serviceId } };
    }
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase();
      const taken = await this.prisma.user.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException('Cet e-mail est déjà utilisé');
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: userPublicSelect,
      });
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });
  }

  async deactivateForRhAdmin(
    actor: RequestUser,
    id: string,
  ): Promise<UserPublic> {
    this.assertRhAdminWithCompany(actor);

    if (actor.id === id) {
      throw new BadRequestException(
        'Vous ne pouvez pas désactiver votre propre compte',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (existing.companyId !== actor.companyId) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userPublicSelect,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: USER_AUDIT.DEACTIVATED,
        entityType: 'User',
        entityId: id,
      },
    });

    return updated;
  }

  async reactivateForRhAdmin(
    actor: RequestUser,
    id: string,
  ): Promise<UserPublic> {
    this.assertRhAdminWithCompany(actor);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (existing.companyId !== actor.companyId) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: userPublicSelect,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: USER_AUDIT.REACTIVATED,
        entityType: 'User',
        entityId: id,
      },
    });

    return updated;
  }

  private assertRhAdminWithCompany(actor: RequestUser): void {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
  }

  static readonly importTemplateCsv =
    'matricule,prenom,nom,email,departement,poste\n' +
    'EMP-001,Jean,Dupont,jean.dupont@exemple.com,RH,Assistant RH\n';

  async importEmployees(
    file: Express.Multer.File,
    adminUser: RequestUser,
  ): Promise<ImportEmployeesReport> {
    this.assertRhAdminWithCompany(adminUser);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier vide ou manquant');
    }
    const byteLength = file.size ?? file.buffer.length;
    if (byteLength > IMPORT_MAX_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (max 5 Mo)');
    }
    if (
      !IMPORT_ALLOWED_MIMES.includes(
        file.mimetype as (typeof IMPORT_ALLOWED_MIMES)[number],
      )
    ) {
      throw new BadRequestException(
        'Format non supporté (CSV ou Excel .xls / .xlsx uniquement)',
      );
    }

    let rows: ReturnType<typeof parseCsvBuffer>;
    try {
      if (file.mimetype === 'text/csv') {
        rows = parseCsvBuffer(file.buffer);
      } else {
        rows = parseXlsxBuffer(file.buffer);
      }
    } catch {
      throw new BadRequestException('Impossible de lire le fichier');
    }

    if (rows.length === 0) {
      return { total: 0, created: 0, errors: 0, errorDetails: [] };
    }

    const firstKeys = Object.keys(rows[0] ?? {});
    const hasHeaders = ['matricule', 'prenom', 'nom', 'email'].every((k) =>
      firstKeys.includes(k),
    );
    if (!hasHeaders) {
      throw new BadRequestException(
        'En-têtes invalides : matricule, prenom, nom, email sont requis',
      );
    }

    const report: ImportEmployeesReport = {
      total: rows.length,
      created: 0,
      errors: 0,
      errorDetails: [],
    };

    const seenEmails = new Set<string>();
    const seenMatricules = new Set<string>();
    const companyId = adminUser.companyId!;

    const deptRows = await this.prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const deptByNorm = new Map<string, string>();
    for (const d of deptRows) {
      const key = d.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      deptByNorm.set(key, d.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const raw = rows[i];
      const f = extractImportFields(raw);
      const matriculeKey = f.matricule.trim();
      const emailKey = f.email.trim().toLowerCase();

      const pushErr = (reason: string) => {
        report.errors += 1;
        report.errorDetails.push({
          line,
          matricule: matriculeKey || '—',
          reason,
        });
      };

      if (!matriculeKey) {
        pushErr('Matricule requis');
        continue;
      }
      if (!f.prenom.trim()) {
        pushErr('Prénom requis');
        continue;
      }
      if (!f.nom.trim()) {
        pushErr('Nom requis');
        continue;
      }
      if (!emailKey || !isEmail(emailKey)) {
        pushErr('E-mail invalide');
        continue;
      }

      if (seenMatricules.has(matriculeKey) || seenEmails.has(emailKey)) {
        pushErr('Doublon dans le fichier (e-mail ou matricule)');
        continue;
      }
      seenMatricules.add(matriculeKey);
      seenEmails.add(emailKey);

      const emailTaken = await this.emailTaken(emailKey);
      if (emailTaken) {
        pushErr('E-mail déjà utilisé');
        continue;
      }

      const matriculeTaken = await this.prisma.user.findFirst({
        where: { companyId, employeeId: matriculeKey },
        select: { id: true },
      });
      if (matriculeTaken) {
        pushErr('Matricule déjà utilisé dans l’entreprise');
        continue;
      }

      const rawDept = f.departement.trim();
      let departmentId: string | undefined;
      if (rawDept) {
        const key = rawDept
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        departmentId = deptByNorm.get(key);
      }

      try {
        await this.auth.inviteEmployee(
          {
            email: emailKey,
            firstName: f.prenom.trim(),
            lastName: f.nom.trim(),
            employeeId: matriculeKey,
            department:
              rawDept && !departmentId ? rawDept : undefined,
            departmentId,
            position: f.poste.trim() || undefined,
          },
          adminUser,
        );
        report.created += 1;
      } catch (e) {
        const reason =
          e instanceof ConflictException
            ? 'E-mail ou matricule déjà utilisé'
            : e instanceof ForbiddenException
              ? 'Opération interdite'
              : e instanceof Error
                ? e.message
                : 'Erreur inconnue';
        pushErr(reason);
      }
    }

    return report;
  }
}
