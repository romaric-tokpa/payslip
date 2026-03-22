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
import { AuthService, type BulkInviteEmployeeRow } from '../auth/auth.service';
import { normalizeString } from '../common/utils/string-similarity.util';
import { generateTempPassword } from '../common/utils/temp-password.util';
import { EmailService } from '../email/email.service';
import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { buildCredentialsPdfBuffer } from './credentials-pdf.util';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  userPublicSelect,
  type UserPublicClient,
  type UserPublicRow,
} from './dto/user-public.select';
import { USER_AUDIT } from './users.constants';
import {
  IMPORT_MAX_BYTES,
  type ImportEmployeesReport,
  type ImportProgressEvent,
} from './users-import.types';
import type { OrgLabelMapsDto } from './dto/org-label-maps.dto';
import type {
  ImportResultDetailDto,
  ImportResultDto,
  ImportRowDto,
  ValidateImportResponseDto,
  ValidatedRowDto,
  ValidationErrorDto,
  ValidationWarningDto,
} from './dto/import-validate.dto';
import type {
  ActivatedCredentialDto,
  BulkActivateDto,
  BulkActivateResponseDto,
} from './dto/bulk-activate.dto';
import type { UserImportConfigDto } from './dto/user-import-config.dto';
import {
  extractImportFields,
  importHeadersSatisfyRequired,
  parseCsvBuffer,
  parseImportBufferRaw,
  parseXlsxBuffer,
  resolveImportParser,
  rowFromExplicitMappings,
} from './users-import.parse';

const PROFILE_PHOTO_URL_TTL_SEC = 7 * 24 * 3600;

export type PaginatedUsers = {
  data: UserPublicClient[];
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
  user: UserPublicClient;
  company: CompanyBrief | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organization: OrganizationService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
  ) {}

  private extFromProfileMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException('Type d’image non supporté');
    }
  }

  private async toPublicClient(row: UserPublicRow): Promise<UserPublicClient> {
    const { profilePhotoKey, ...rest } = row;
    let profilePhotoUrl: string | null = null;
    if (profilePhotoKey) {
      profilePhotoUrl = await this.storage.getPresignedUrl(
        profilePhotoKey,
        PROFILE_PHOTO_URL_TTL_SEC,
      );
    }
    return { ...rest, profilePhotoUrl };
  }

  private async toPublicClients(
    rows: UserPublicRow[],
  ): Promise<UserPublicClient[]> {
    return Promise.all(rows.map((r) => this.toPublicClient(r)));
  }

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

  /**
   * Connexion app mobile collaborateur : matricule seul (sans mot de passe).
   * Plusieurs lignes = même libellé de matricule dans des entreprises différentes.
   */
  findActiveEmployeesByEmployeeIdInsensitive(raw: string): Promise<User[]> {
    const trimmed = raw.trim();
    if (!trimmed) {
      return Promise.resolve([]);
    }
    return this.prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true,
        employeeId: { equals: trimmed, mode: 'insensitive' },
      },
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
    return { user: await this.toPublicClient(user), company };
  }

  async uploadProfilePhoto(
    actor: RequestUser,
    file: Express.Multer.File,
  ): Promise<MeResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { profilePhotoKey: true, companyId: true },
    });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const ext = this.extFromProfileMime(file.mimetype);
    const companySegment = existing.companyId ?? 'no-company';
    const key = this.storage.buildProfilePhotoKey(
      companySegment,
      actor.id,
      ext,
    );

    if (existing.profilePhotoKey && existing.profilePhotoKey !== key) {
      try {
        await this.storage.deleteFile(existing.profilePhotoKey);
      } catch {
        /* remplacement : suppression ancienne clé best-effort */
      }
    }

    await this.storage.uploadFileWithRetry(file.buffer, key, file.mimetype);

    await this.prisma.user.update({
      where: { id: actor.id },
      data: { profilePhotoKey: key },
    });

    return this.getMe(actor);
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
      data: await this.toPublicClients(rows),
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

    const act = query.activationStatus ?? 'all';
    if (act === 'active') {
      where.isActive = true;
      where.mustChangePassword = false;
    } else if (act === 'inactive') {
      where.isActive = false;
    } else if (act === 'pending_password') {
      where.isActive = true;
      where.mustChangePassword = true;
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

  async findOneForActor(
    actor: RequestUser,
    id: string,
  ): Promise<UserPublicClient> {
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
      return this.toPublicClient(user);
    }

    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId || user.companyId !== actor.companyId) {
        throw new ForbiddenException();
      }
      return this.toPublicClient(user);
    }

    if (actor.role === 'SUPER_ADMIN') {
      return this.toPublicClient(user);
    }

    throw new ForbiddenException();
  }

  async updateForRhAdmin(
    actor: RequestUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserPublicClient> {
    this.assertRhAdminWithCompany(actor);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (existing.companyId !== actor.companyId) {
      throw new ForbiddenException();
    }

    const resolvedDepartmentId =
      dto.departmentId !== undefined ? dto.departmentId : existing.departmentId;
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
      const row = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: userPublicSelect,
      });
      return this.toPublicClient(row);
    }

    const row = await this.prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });
    return this.toPublicClient(row);
  }

  async deactivateForRhAdmin(
    actor: RequestUser,
    id: string,
  ): Promise<UserPublicClient> {
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

    return this.toPublicClient(updated);
  }

  async reactivateForRhAdmin(
    actor: RequestUser,
    id: string,
  ): Promise<UserPublicClient> {
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

    return this.toPublicClient(updated);
  }

  private assertRhAdminWithCompany(actor: RequestUser): void {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
  }

  private assertUserImportConfig(config: UserImportConfigDto): void {
    const { mappings, splitFullName } = config;
    if (!mappings.matricule?.trim() || !mappings.email?.trim()) {
      throw new BadRequestException(
        'importConfig : les colonnes matricule et e-mail sont obligatoires dans mappings',
      );
    }
    if (splitFullName) {
      if (!splitFullName.column?.trim()) {
        throw new BadRequestException(
          'importConfig : splitFullName.column est obligatoire',
        );
      }
      return;
    }
    if (!mappings.prenom?.trim() || !mappings.nom?.trim()) {
      throw new BadRequestException(
        'importConfig : prénom et nom sont obligatoires, ou fournissez splitFullName',
      );
    }
  }

  private normalizeImportOrgLabel(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private orgMapLookup(
    map: Record<string, string> | undefined,
    raw: string,
  ): string | undefined {
    const r = raw.trim();
    if (!r || !map) {
      return undefined;
    }
    if (map[r] !== undefined) {
      return map[r];
    }
    const n = normalizeString(r);
    for (const [k, v] of Object.entries(map)) {
      if (normalizeString(k) === n) {
        return v;
      }
    }
    return undefined;
  }

  private isOrgLabelIgnored(raw: string, list: string[] | undefined): boolean {
    const r = raw.trim();
    if (!r || !list?.length) {
      return false;
    }
    const n = normalizeString(r);
    for (const x of list) {
      if (normalizeString(x) === n) {
        return true;
      }
    }
    return false;
  }

  /**
   * Résout département (libellé ou UUID via orgLabelMaps) + service org.
   * Si le service est rattaché à un département, celui-ci est appliqué (ou contrôlé vs le libellé département).
   */
  private resolveImportOrgFields(
    rawDept: string,
    rawService: string,
    deptByNorm: Map<string, string>,
    serviceRows: ReadonlyArray<{
      id: string;
      name: string;
      departmentId: string | null;
    }>,
    orgLabelMaps: OrgLabelMapsDto | undefined,
    deptIdSet: ReadonlySet<string>,
    serviceIdSet: ReadonlySet<string>,
  ):
    | {
        ok: true;
        departmentId?: string;
        serviceId?: string;
        departmentFreeText?: string;
      }
    | { ok: false; reason: string } {
    const serviceByNorm = new Map<
      string,
      { id: string; departmentId: string | null }
    >();
    const serviceById = new Map<
      string,
      { id: string; departmentId: string | null }
    >();
    for (const s of serviceRows) {
      serviceByNorm.set(this.normalizeImportOrgLabel(s.name), {
        id: s.id,
        departmentId: s.departmentId,
      });
      serviceById.set(s.id, {
        id: s.id,
        departmentId: s.departmentId,
      });
    }

    let rd = rawDept.trim();
    if (this.isOrgLabelIgnored(rawDept, orgLabelMaps?.ignoredDepartments)) {
      rd = '';
    }
    let rs = rawService.trim();
    if (this.isOrgLabelIgnored(rawService, orgLabelMaps?.ignoredServices)) {
      rs = '';
    }

    let departmentId: string | undefined;
    if (rd) {
      const mappedDept = this.orgMapLookup(orgLabelMaps?.departmentMap, rd);
      if (mappedDept !== undefined) {
        if (!deptIdSet.has(mappedDept)) {
          return {
            ok: false,
            reason:
              'Département introuvable (identifiant issu de la résolution organisationnelle)',
          };
        }
        departmentId = mappedDept;
      } else {
        departmentId = deptByNorm.get(this.normalizeImportOrgLabel(rd));
      }
    }

    let serviceId: string | undefined;
    if (rs) {
      const mappedSvc = this.orgMapLookup(orgLabelMaps?.serviceMap, rs);
      const hit = mappedSvc
        ? serviceById.get(mappedSvc)
        : serviceByNorm.get(this.normalizeImportOrgLabel(rs));
      if (!hit) {
        return {
          ok: false,
          reason:
            'Service inconnu (aucun service de l’entreprise ne correspond à ce libellé)',
        };
      }
      if (mappedSvc !== undefined && !serviceIdSet.has(mappedSvc)) {
        return {
          ok: false,
          reason:
            'Service introuvable (identifiant issu de la résolution organisationnelle)',
        };
      }
      serviceId = hit.id;
      if (hit.departmentId) {
        if (departmentId !== undefined && departmentId !== hit.departmentId) {
          return {
            ok: false,
            reason:
              'Département et service incohérents (ce service est rattaché à un autre département)',
          };
        }
        departmentId = hit.departmentId;
      }
    }

    const departmentFreeText = rd && !departmentId ? rd : undefined;
    return { ok: true, departmentId, serviceId, departmentFreeText };
  }

  async importEmployees(
    file: Express.Multer.File,
    adminUser: RequestUser,
    importConfig?: UserImportConfigDto | null,
    progress?: {
      onEvent: (e: ImportProgressEvent) => void;
      /** Émettre au plus toutes les N lignes traitées (défaut 10) */
      throttleRows?: number;
    },
  ): Promise<ImportEmployeesReport> {
    this.assertRhAdminWithCompany(adminUser);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier vide ou manquant');
    }
    const byteLength = file.size ?? file.buffer.length;
    if (byteLength > IMPORT_MAX_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (max 5 Mo)');
    }

    progress?.onEvent({ kind: 'parsing' });

    let normalizedRows: ReturnType<typeof parseCsvBuffer>;

    try {
      if (importConfig) {
        this.assertUserImportConfig(importConfig);
        const { rows } = parseImportBufferRaw(file);
        normalizedRows = rows.map((r) =>
          rowFromExplicitMappings(
            r,
            importConfig.mappings,
            importConfig.splitFullName ?? null,
          ),
        );
      } else {
        const parser = resolveImportParser(file);
        normalizedRows =
          parser === 'csv'
            ? parseCsvBuffer(file.buffer)
            : parseXlsxBuffer(file.buffer);
      }
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('Impossible de lire le fichier');
    }

    if (normalizedRows.length === 0) {
      return { total: 0, created: 0, updated: 0, errors: 0, errorDetails: [] };
    }

    if (!importConfig) {
      const headerKeys = Object.keys(normalizedRows[0] ?? {});
      if (!importHeadersSatisfyRequired(headerKeys)) {
        const preview = headerKeys.filter(Boolean).slice(0, 20).join(', ');
        throw new BadRequestException(
          `Colonnes obligatoires introuvables : matricule, prénom, nom, e-mail (libellés proches acceptés). En-têtes lus : ${preview || '(aucune)'} — placez les titres de colonnes sur la 1re ligne de la feuille.`,
        );
      }
    }

    const allIndices = normalizedRows.map((_, i) => i);
    let indicesToProcess = allIndices;
    if (importConfig?.rowIndices !== undefined) {
      for (const idx of importConfig.rowIndices) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= normalizedRows.length) {
          throw new BadRequestException(`Indice de ligne invalide : ${idx}`);
        }
      }
      indicesToProcess = [...new Set(importConfig.rowIndices)].sort(
        (a, b) => a - b,
      );
    }

    const report: ImportEmployeesReport = {
      total: indicesToProcess.length,
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: [],
    };

    const seenMatricules = new Set<string>();
    const matriculeFirstLine = new Map<string, number>();
    const companyId = adminUser.companyId!;

    const deptRows = await this.prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const deptByNorm = new Map<string, string>();
    for (const d of deptRows) {
      deptByNorm.set(this.normalizeImportOrgLabel(d.name), d.id);
    }

    const serviceRows = await this.prisma.service.findMany({
      where: { companyId },
      select: { id: true, name: true, departmentId: true },
    });

    const deptIdSet = new Set(deptRows.map((d) => d.id));
    const serviceIdSet = new Set(serviceRows.map((s) => s.id));
    const deptNameById = new Map(
      deptRows.map((d) => [d.id, d.name] as const),
    );

    const seenEmails = new Set<string>();
    const emailFirstLine = new Map<string, number>();

    type PreparedRow = {
      line: number;
      matriculeKey: string;
      emailKey: string;
      f: ReturnType<typeof extractImportFields>;
      departmentId?: string;
      serviceId?: string;
      departmentFreeText?: string;
    };

    const prepared: PreparedRow[] = [];

    for (const i of indicesToProcess) {
      const line = i + 2;
      const raw = normalizedRows[i];
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
        pushErr('Matricule vide');
        continue;
      }
      if (!f.prenom.trim()) {
        pushErr('Prénom vide');
        continue;
      }
      if (!f.nom.trim()) {
        pushErr('Nom vide');
        continue;
      }
      if (!emailKey || !isEmail(emailKey)) {
        pushErr('Email invalide');
        continue;
      }

      if (seenMatricules.has(matriculeKey)) {
        const first = matriculeFirstLine.get(matriculeKey);
        pushErr(
          first !== undefined
            ? `Doublon (matricule, voir ligne ${first})`
            : 'Doublon dans le fichier (matricule)',
        );
        continue;
      }
      seenMatricules.add(matriculeKey);
      matriculeFirstLine.set(matriculeKey, line);

      if (seenEmails.has(emailKey)) {
        const first = emailFirstLine.get(emailKey);
        pushErr(
          first !== undefined
            ? `Doublon (e-mail, voir ligne ${first})`
            : 'Doublon dans le fichier (e-mail)',
        );
        continue;
      }
      seenEmails.add(emailKey);
      emailFirstLine.set(emailKey, line);

      const org = this.resolveImportOrgFields(
        f.departement,
        f.service,
        deptByNorm,
        serviceRows,
        importConfig?.orgLabelMaps,
        deptIdSet,
        serviceIdSet,
      );
      if (!org.ok) {
        pushErr(org.reason);
        continue;
      }
      const { departmentId, serviceId, departmentFreeText } = org;

      prepared.push({
        line,
        matriculeKey,
        emailKey,
        f,
        departmentId,
        serviceId,
        departmentFreeText,
      });
    }

    progress?.onEvent({
      kind: 'start',
      total: prepared.length,
      sourceTotal: report.total,
    });

    const throttleRows = Math.max(1, progress?.throttleRows ?? 10);
    const emitProgress = (processed: number, force = false) => {
      if (!progress?.onEvent) {
        return;
      }
      if (
        force ||
        processed % throttleRows === 0 ||
        processed === prepared.length
      ) {
        progress.onEvent({
          kind: 'progress',
          processed,
          total: prepared.length,
          created: report.created,
          updated: report.updated,
          errors: report.errors,
        });
      }
    };

    const matriculeKeys = [...new Set(prepared.map((p) => p.matriculeKey))];
    const existingByMatriculeRows = await this.prisma.user.findMany({
      where: { companyId, employeeId: { in: matriculeKeys } },
      select: { id: true, employeeId: true },
    });
    const matriculeToUserId = new Map(
      existingByMatriculeRows
        .filter((u) => u.employeeId != null && u.employeeId !== '')
        .map((u) => [u.employeeId!, u.id] as const),
    );

    const emailKeys = [...new Set(prepared.map((p) => p.emailKey))];
    const existingByEmailRows = await this.prisma.user.findMany({
      where: { email: { in: emailKeys } },
      select: { id: true, email: true, companyId: true },
    });
    const emailOwnerMap = new Map(
      existingByEmailRows.map((u) => [u.email.toLowerCase(), u] as const),
    );

    type PendingCreate = { line: number; row: BulkInviteEmployeeRow };

    const importErrMessage = (e: unknown): string =>
      e instanceof ConflictException
        ? e.message
        : e instanceof ForbiddenException
          ? 'Opération interdite'
          : e instanceof NotFoundException
            ? 'Utilisateur introuvable'
            : e instanceof Error
              ? e.message
              : 'Erreur inconnue';

    const CREATE_BATCH = 50;

    const pushReportErr = (
      line: number,
      matriculeKey: string,
      reason: string,
    ) => {
      report.errors += 1;
      report.errorDetails.push({
        line,
        matricule: matriculeKey || '—',
        reason,
      });
    };

    const flushCreateBuffer = async (buf: PendingCreate[]) => {
      if (buf.length === 0) {
        return;
      }
      for (let j = 0; j < buf.length; j += CREATE_BATCH) {
        const slice = buf.slice(j, j + CREATE_BATCH);
        const payloads = slice.map((c) => c.row);
        try {
          await this.auth.createInvitedEmployeesBulk(payloads, adminUser, {
            batchSize: slice.length,
            transactionTimeoutMs: 120_000,
          });
          report.created += slice.length;
        } catch {
          for (const c of slice) {
            try {
              await this.auth.inviteEmployee(
                {
                  email: c.row.email,
                  firstName: c.row.firstName,
                  lastName: c.row.lastName,
                  employeeId: c.row.employeeId,
                  department: c.row.department ?? undefined,
                  departmentId: c.row.departmentId ?? undefined,
                  serviceId: c.row.serviceId ?? undefined,
                  position: c.row.position ?? undefined,
                },
                adminUser,
              );
              report.created += 1;
            } catch (e) {
              pushReportErr(
                c.line,
                c.row.employeeId,
                importErrMessage(e),
              );
            }
          }
        }
      }
      buf.length = 0;
    };

    const createBuffer: PendingCreate[] = [];

    let rowProcessed = 0;
    for (const p of prepared) {
      const existingByMatriculeId = matriculeToUserId.get(p.matriculeKey);

      if (existingByMatriculeId) {
        await flushCreateBuffer(createBuffer);

        const emailOwner = emailOwnerMap.get(p.emailKey);
        if (emailOwner && emailOwner.id !== existingByMatriculeId) {
          pushReportErr(
            p.line,
            p.matriculeKey,
            emailOwner.companyId === companyId
              ? 'E-mail déjà utilisé par un autre collaborateur (matricule différent)'
              : 'E-mail déjà utilisé',
          );
          continue;
        }

        const updateDto: UpdateUserDto = {
          firstName: p.f.prenom.trim(),
          lastName: p.f.nom.trim(),
          email: p.emailKey,
        };
        if (p.f.poste.trim()) {
          updateDto.position = p.f.poste.trim();
        }
        if (p.departmentId) {
          updateDto.departmentId = p.departmentId;
        } else if (p.departmentFreeText) {
          updateDto.department = p.departmentFreeText;
        }
        if (p.serviceId) {
          updateDto.serviceId = p.serviceId;
        }

        try {
          await this.updateForRhAdmin(
            adminUser,
            existingByMatriculeId,
            updateDto,
          );
          report.updated += 1;
        } catch (e) {
          pushReportErr(p.line, p.matriculeKey, importErrMessage(e));
        }
        continue;
      }

      const emailOwner = emailOwnerMap.get(p.emailKey);
      if (emailOwner) {
        pushReportErr(
          p.line,
          p.matriculeKey,
          emailOwner.companyId === companyId
            ? 'E-mail déjà utilisé par un autre collaborateur (matricule différent)'
            : 'E-mail déjà utilisé',
        );
        continue;
      }

      let departmentLabel: string | null = p.departmentFreeText ?? null;
      if (p.departmentId) {
        departmentLabel = deptNameById.get(p.departmentId) ?? departmentLabel;
      }

      createBuffer.push({
        line: p.line,
        row: {
          email: p.emailKey,
          firstName: p.f.prenom.trim(),
          lastName: p.f.nom.trim(),
          employeeId: p.matriculeKey,
          department: departmentLabel,
          departmentId: p.departmentId ?? null,
          serviceId: p.serviceId ?? null,
          position: p.f.poste.trim() || null,
        },
      });

      if (createBuffer.length >= CREATE_BATCH) {
        await flushCreateBuffer(createBuffer);
      }

      rowProcessed += 1;
      emitProgress(rowProcessed);
    }

    await flushCreateBuffer(createBuffer);

    emitProgress(rowProcessed, true);

    return report;
  }

  /**
   * Validation sèche (dry-run) pour l’import JSON : aucune écriture en base.
   * Aligné sur importEmployees : mise à jour par matricule, e-mail unique plateforme.
   */
  async validateImportRows(
    adminUser: RequestUser,
    rows: ImportRowDto[],
  ): Promise<ValidateImportResponseDto> {
    this.assertRhAdminWithCompany(adminUser);
    const companyId = adminUser.companyId!;

    const deptRows = await this.prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const deptByNorm = new Map<string, string>();
    for (const d of deptRows) {
      deptByNorm.set(this.normalizeImportOrgLabel(d.name), d.id);
    }

    const serviceRows = await this.prisma.service.findMany({
      where: { companyId },
      select: { id: true, name: true, departmentId: true },
    });

    const deptIdSet = new Set(deptRows.map((d) => d.id));
    const serviceIdSet = new Set(serviceRows.map((s) => s.id));

    const existingCompanyUsers = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
        departmentId: true,
        serviceId: true,
        orgDepartment: { select: { name: true } },
        orgService: { select: { name: true } },
      },
    });

    const emailNorm = (e: string) => e.trim().toLowerCase();
    const matriculeMap = new Map<string, (typeof existingCompanyUsers)[number]>();
    for (const u of existingCompanyUsers) {
      const m = u.employeeId?.trim();
      if (m) {
        matriculeMap.set(m, u);
      }
    }

    const distinctEmails = [
      ...new Set(
        rows
          .map((r) => emailNorm(r.email ?? ''))
          .filter((e) => e.length > 0),
      ),
    ];
    const globalEmailOwners =
      distinctEmails.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { email: { in: distinctEmails } },
            select: {
              id: true,
              email: true,
              companyId: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          });
    const globalEmailMap = new Map(
      globalEmailOwners.map((u) => [u.email.toLowerCase(), u] as const),
    );

    const fileEmails = new Map<string, number[]>();
    const fileMatricules = new Map<string, number[]>();
    for (const row of rows) {
      const em = emailNorm(row.email ?? '');
      if (em) {
        const arr = fileEmails.get(em) ?? [];
        arr.push(row.rowIndex);
        fileEmails.set(em, arr);
      }
      const mat = row.employeeId?.trim() ?? '';
      if (mat) {
        const arr = fileMatricules.get(mat) ?? [];
        arr.push(row.rowIndex);
        fileMatricules.set(mat, arr);
      }
    }

    const validatedRows: ValidatedRowDto[] = [];

    const lineLabel = (idx: number) => String(idx + 2);

    for (const row of rows) {
      const errors: ValidationErrorDto[] = [];
      const warnings: ValidationWarningDto[] = [];
      let status: ValidatedRowDto['status'] = 'ready';
      let existingUserId: string | undefined;
      let existingEmployeeId: string | undefined;
      let existingSnapshot: ValidatedRowDto['existingSnapshot'];

      const matricule = row.employeeId?.trim() ?? '';
      const email = emailNorm(row.email ?? '');

      if (!matricule) {
        errors.push({
          field: 'employeeId',
          message: 'Matricule manquant',
          code: 'REQUIRED',
        });
      }
      if (!row.firstName?.trim()) {
        errors.push({
          field: 'firstName',
          message: 'Prénom manquant',
          code: 'REQUIRED',
        });
      }
      if (!row.lastName?.trim()) {
        errors.push({
          field: 'lastName',
          message: 'Nom manquant',
          code: 'REQUIRED',
        });
      }
      if (!email) {
        errors.push({
          field: 'email',
          message: 'E-mail manquant',
          code: 'REQUIRED',
        });
      } else if (!isEmail(email)) {
        errors.push({
          field: 'email',
          message: `E-mail invalide : « ${row.email} »`,
          code: 'INVALID_EMAIL',
        });
      }

      const org = this.resolveImportOrgFromDtoRow(
        row,
        deptByNorm,
        serviceRows,
        deptIdSet,
        serviceIdSet,
      );
      if (!org.ok) {
        errors.push({
          field: 'departmentId',
          message: org.reason,
          code: 'ORG_INVALID',
        });
      }

      if (email && fileEmails.get(email) && fileEmails.get(email)!.length > 1) {
        const other = fileEmails
          .get(email)!
          .filter((l) => l !== row.rowIndex)
          .map(lineLabel);
        errors.push({
          field: 'email',
          message: `E-mail en doublon avec la ligne ${other.join(', ')}`,
          code: 'DUPLICATE_IN_FILE',
        });
      }

      if (
        matricule &&
        fileMatricules.get(matricule) &&
        fileMatricules.get(matricule)!.length > 1
      ) {
        const other = fileMatricules
          .get(matricule)!
          .filter((l) => l !== row.rowIndex)
          .map(lineLabel);
        errors.push({
          field: 'employeeId',
          message: `Matricule en doublon avec la ligne ${other.join(', ')}`,
          code: 'DUPLICATE_MATRICULE_IN_FILE',
        });
      }

      const existingByMatricule = matricule ? matriculeMap.get(matricule) : undefined;
      const emailOwner = email ? globalEmailMap.get(email) : undefined;

      if (existingByMatricule) {
        existingUserId = existingByMatricule.id;
        existingEmployeeId = existingByMatricule.employeeId ?? undefined;
        status = 'update';
        const deptLabel =
          existingByMatricule.orgDepartment?.name ??
          existingByMatricule.department ??
          null;
        const svcLabel = existingByMatricule.orgService?.name ?? null;
        existingSnapshot = {
          firstName: existingByMatricule.firstName,
          lastName: existingByMatricule.lastName,
          email: existingByMatricule.email,
          position: existingByMatricule.position,
          department: deptLabel,
          service: svcLabel,
        };
        warnings.push({
          field: 'employeeId',
          message: `Collaborateur existant (${existingByMatricule.firstName} ${existingByMatricule.lastName}, ${existingByMatricule.employeeId ?? 'sans matricule'}) — la fiche sera mise à jour`,
          code: 'EXISTING_USER',
        });

        if (emailOwner && emailOwner.id !== existingByMatricule.id) {
          errors.push({
            field: 'email',
            message:
              emailOwner.companyId === companyId
                ? `E-mail déjà utilisé par ${emailOwner.firstName} ${emailOwner.lastName} (${emailOwner.employeeId ?? 'sans matricule'})`
                : 'E-mail déjà utilisé sur la plateforme',
            code: 'DUPLICATE_EMAIL',
            suggestion:
              emailOwner.companyId === companyId
                ? `Utilisez l’e-mail du titulaire du matricule ou un autre e-mail unique`
                : undefined,
          });
        }
      } else if (emailOwner) {
        if (emailOwner.companyId !== companyId) {
          errors.push({
            field: 'email',
            message: 'E-mail déjà utilisé sur la plateforme',
            code: 'DUPLICATE_EMAIL',
          });
        } else {
          errors.push({
            field: 'email',
            message: `E-mail déjà utilisé par un autre collaborateur (matricule différent) : ${emailOwner.firstName} ${emailOwner.lastName} (${emailOwner.employeeId ?? 'sans matricule'})`,
            code: 'DUPLICATE_EMAIL',
            suggestion: `Associez ce fichier au matricule ${emailOwner.employeeId ?? '…'} pour une mise à jour, ou changez l’e-mail`,
          });
        }
      }

      if (!row.position?.trim()) {
        warnings.push({
          field: 'position',
          message: 'Poste non renseigné',
          code: 'OPTIONAL_MISSING',
        });
      }

      if (errors.length > 0) {
        status = 'error';
      } else if (status !== 'update' && warnings.length > 0) {
        status = 'warning';
      }

      validatedRows.push({
        rowIndex: row.rowIndex,
        status,
        data: row,
        existingUserId,
        existingEmployeeId,
        existingSnapshot,
        errors,
        warnings,
      });
    }

    return {
      summary: {
        total: rows.length,
        ready: validatedRows.filter((r) => r.status === 'ready').length,
        updates: validatedRows.filter((r) => r.status === 'update').length,
        errors: validatedRows.filter((r) => r.status === 'error').length,
        warnings: validatedRows.filter((r) => r.status === 'warning').length,
      },
      rows: validatedRows,
    };
  }

  /**
   * Import JSON après validation côté UI : une entrée dans details par ligne envoyée.
   */
  async commitImportRows(
    adminUser: RequestUser,
    rows: ImportRowDto[],
  ): Promise<ImportResultDto> {
    this.assertRhAdminWithCompany(adminUser);
    const companyId = adminUser.companyId!;

    const empty: ImportResultDto = {
      summary: { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
      details: [],
    };

    if (rows.length === 0) {
      return empty;
    }

    const deptRows = await this.prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const deptByNorm = new Map<string, string>();
    for (const d of deptRows) {
      deptByNorm.set(this.normalizeImportOrgLabel(d.name), d.id);
    }

    const serviceRows = await this.prisma.service.findMany({
      where: { companyId },
      select: { id: true, name: true, departmentId: true },
    });

    const deptIdSet = new Set(deptRows.map((d) => d.id));
    const serviceIdSet = new Set(serviceRows.map((s) => s.id));
    const deptNameById = new Map(deptRows.map((d) => [d.id, d.name] as const));

    const emailNorm = (e: string) => e.trim().toLowerCase();

    type PreparedCommit = {
      row: ImportRowDto;
      matriculeKey: string;
      emailKey: string;
      departmentId?: string;
      serviceId?: string;
      departmentFreeText?: string;
    };

    const prepared: PreparedCommit[] = [];
    const detailByRowIndex = new Map<number, ImportResultDetailDto>();

    const setDetail = (d: ImportResultDetailDto) => {
      detailByRowIndex.set(d.rowIndex, d);
    };

    const fileEmails = new Map<string, number[]>();
    const fileMatricules = new Map<string, number[]>();
    for (const row of rows) {
      const em = emailNorm(row.email ?? '');
      if (em) {
        const arr = fileEmails.get(em) ?? [];
        arr.push(row.rowIndex);
        fileEmails.set(em, arr);
      }
      const mat = row.employeeId?.trim() ?? '';
      if (mat) {
        const arr = fileMatricules.get(mat) ?? [];
        arr.push(row.rowIndex);
        fileMatricules.set(mat, arr);
      }
    }

    for (const row of rows) {
      const matriculeKey = row.employeeId?.trim() ?? '';
      const emailKey = emailNorm(row.email ?? '');

      if (!matriculeKey) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: row.employeeId,
          status: 'error',
          errorMessage: 'Matricule manquant',
          errorField: 'employeeId',
        });
        continue;
      }
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: matriculeKey,
          status: 'error',
          errorMessage: !row.firstName?.trim()
            ? 'Prénom manquant'
            : 'Nom manquant',
          errorField: !row.firstName?.trim() ? 'firstName' : 'lastName',
        });
        continue;
      }
      if (!emailKey || !isEmail(emailKey)) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: matriculeKey,
          status: 'error',
          errorMessage: 'E-mail manquant ou invalide',
          errorField: 'email',
        });
        continue;
      }

      if (fileEmails.get(emailKey) && fileEmails.get(emailKey)!.length > 1) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: matriculeKey,
          status: 'error',
          errorMessage: 'E-mail en doublon dans le lot importé',
          errorField: 'email',
        });
        continue;
      }
      if (
        fileMatricules.get(matriculeKey) &&
        fileMatricules.get(matriculeKey)!.length > 1
      ) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: matriculeKey,
          status: 'error',
          errorMessage: 'Matricule en doublon dans le lot importé',
          errorField: 'employeeId',
        });
        continue;
      }

      const org = this.resolveImportOrgFromDtoRow(
        row,
        deptByNorm,
        serviceRows,
        deptIdSet,
        serviceIdSet,
      );
      if (!org.ok) {
        setDetail({
          rowIndex: row.rowIndex,
          email: row.email ?? '',
          employeeId: matriculeKey,
          status: 'error',
          errorMessage: org.reason,
          errorField: 'departmentId',
        });
        continue;
      }

      prepared.push({
        row,
        matriculeKey,
        emailKey,
        departmentId: org.departmentId,
        serviceId: org.serviceId,
        departmentFreeText: org.departmentFreeText,
      });
    }

    const matriculeKeys = [...new Set(prepared.map((p) => p.matriculeKey))];
    const existingByMatriculeRows = await this.prisma.user.findMany({
      where: { companyId, employeeId: { in: matriculeKeys } },
      select: { id: true, employeeId: true },
    });
    const matriculeToUserId = new Map(
      existingByMatriculeRows
        .filter((u) => u.employeeId != null && u.employeeId !== '')
        .map((u) => [u.employeeId!.trim(), u.id] as const),
    );

    const emailKeys = [...new Set(prepared.map((p) => p.emailKey))];
    const existingByEmailRows = await this.prisma.user.findMany({
      where: { email: { in: emailKeys } },
      select: { id: true, email: true, companyId: true },
    });
    const emailOwnerMap = new Map(
      existingByEmailRows.map((u) => [u.email.toLowerCase(), u] as const),
    );

    const importErrMessage = (e: unknown): string =>
      e instanceof ConflictException
        ? e.message
        : e instanceof ForbiddenException
          ? 'Opération interdite'
          : e instanceof NotFoundException
            ? 'Utilisateur introuvable'
            : e instanceof Error
              ? e.message
              : 'Erreur inconnue';

    const CREATE_BATCH = 50;

    type PendingCreate = {
      rowIndex: number;
      row: BulkInviteEmployeeRow;
    };

    const flushCreateBuffer = async (buf: PendingCreate[]) => {
      if (buf.length === 0) {
        return;
      }
      for (let j = 0; j < buf.length; j += CREATE_BATCH) {
        const slice = buf.slice(j, j + CREATE_BATCH);
        const payloads = slice.map((c) => c.row);
        try {
          await this.auth.createInvitedEmployeesBulk(payloads, adminUser, {
            batchSize: slice.length,
            transactionTimeoutMs: 120_000,
          });
          const emailsLower = slice.map((c) => c.row.email.toLowerCase());
          const idByEmail = new Map(
            (
              await this.prisma.user.findMany({
                where: {
                  companyId,
                  email: { in: emailsLower },
                },
                select: { id: true, email: true },
              })
            ).map((u) => [u.email.toLowerCase(), u.id] as const),
          );
          for (const c of slice) {
            setDetail({
              rowIndex: c.rowIndex,
              email: c.row.email,
              employeeId: c.row.employeeId,
              userId: idByEmail.get(c.row.email.toLowerCase()),
              status: 'created',
            });
          }
        } catch {
          for (const c of slice) {
            try {
              await this.auth.inviteEmployee(
                {
                  email: c.row.email,
                  firstName: c.row.firstName,
                  lastName: c.row.lastName,
                  employeeId: c.row.employeeId,
                  department: c.row.department ?? undefined,
                  departmentId: c.row.departmentId ?? undefined,
                  serviceId: c.row.serviceId ?? undefined,
                  position: c.row.position ?? undefined,
                },
                adminUser,
              );
              const created = await this.prisma.user.findUnique({
                where: { email: c.row.email.toLowerCase() },
                select: { id: true },
              });
              setDetail({
                rowIndex: c.rowIndex,
                email: c.row.email,
                employeeId: c.row.employeeId,
                userId: created?.id,
                status: 'created',
              });
            } catch (e) {
              setDetail({
                rowIndex: c.rowIndex,
                email: c.row.email,
                employeeId: c.row.employeeId,
                status: 'error',
                errorMessage: importErrMessage(e),
              });
            }
          }
        }
      }
      buf.length = 0;
    };

    const createBuffer: PendingCreate[] = [];

    for (const p of prepared) {
      const existingByMatriculeId = matriculeToUserId.get(p.matriculeKey);

      if (existingByMatriculeId) {
        await flushCreateBuffer(createBuffer);

        const emailOwner = emailOwnerMap.get(p.emailKey);
        if (emailOwner && emailOwner.id !== existingByMatriculeId) {
          setDetail({
            rowIndex: p.row.rowIndex,
            email: p.row.email,
            employeeId: p.matriculeKey,
            status: 'error',
            errorMessage:
              emailOwner.companyId === companyId
                ? 'E-mail déjà utilisé par un autre collaborateur (matricule différent)'
                : 'E-mail déjà utilisé',
            errorField: 'email',
          });
          continue;
        }

        const updateDto: UpdateUserDto = {
          firstName: p.row.firstName.trim(),
          lastName: p.row.lastName.trim(),
          email: p.emailKey,
        };
        if (p.row.position?.trim()) {
          updateDto.position = p.row.position.trim();
        }
        if (p.departmentId) {
          updateDto.departmentId = p.departmentId;
        } else if (p.departmentFreeText) {
          updateDto.department = p.departmentFreeText;
        }
        if (p.serviceId) {
          updateDto.serviceId = p.serviceId;
        }

        try {
          await this.updateForRhAdmin(
            adminUser,
            existingByMatriculeId,
            updateDto,
          );
          setDetail({
            rowIndex: p.row.rowIndex,
            email: p.row.email,
            employeeId: p.matriculeKey,
            userId: existingByMatriculeId,
            status: 'updated',
          });
        } catch (e) {
          setDetail({
            rowIndex: p.row.rowIndex,
            email: p.row.email,
            employeeId: p.matriculeKey,
            status: 'error',
            errorMessage: importErrMessage(e),
          });
        }
        continue;
      }

      const emailOwner = emailOwnerMap.get(p.emailKey);
      if (emailOwner) {
        await flushCreateBuffer(createBuffer);
        setDetail({
          rowIndex: p.row.rowIndex,
          email: p.row.email,
          employeeId: p.matriculeKey,
          status: 'error',
          errorMessage:
            emailOwner.companyId === companyId
              ? 'E-mail déjà utilisé par un autre collaborateur (matricule différent)'
              : 'E-mail déjà utilisé',
          errorField: 'email',
        });
        continue;
      }

      let departmentLabel: string | null = p.departmentFreeText ?? null;
      if (p.departmentId) {
        departmentLabel = deptNameById.get(p.departmentId) ?? departmentLabel;
      }

      createBuffer.push({
        rowIndex: p.row.rowIndex,
        row: {
          email: p.emailKey,
          firstName: p.row.firstName.trim(),
          lastName: p.row.lastName.trim(),
          employeeId: p.matriculeKey,
          department: departmentLabel,
          departmentId: p.departmentId ?? null,
          serviceId: p.serviceId ?? null,
          position: p.row.position?.trim() || null,
        },
      });

      if (createBuffer.length >= CREATE_BATCH) {
        await flushCreateBuffer(createBuffer);
      }
    }

    await flushCreateBuffer(createBuffer);

    const details: ImportResultDetailDto[] = rows.map((r) => {
      const d = detailByRowIndex.get(r.rowIndex);
      if (!d) {
        return {
          rowIndex: r.rowIndex,
          email: r.email ?? '',
          employeeId: r.employeeId,
          status: 'error' as const,
          errorMessage: 'Ligne non traitée (erreur interne)',
        };
      }
      return d;
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    for (const d of details) {
      if (d.status === 'created') {
        created += 1;
      } else if (d.status === 'updated') {
        updated += 1;
      } else if (d.status === 'skipped') {
        skipped += 1;
      } else if (d.status === 'error') {
        errors += 1;
      }
    }

    return {
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        errors,
      },
      details,
    };
  }

  isActivationEmailConfigured(): boolean {
    return this.email.isSmtpConfigured();
  }

  async bulkActivate(
    actor: RequestUser,
    dto: BulkActivateDto,
  ): Promise<BulkActivateResponseDto> {
    this.assertRhAdminWithCompany(actor);
    const companyId = actor.companyId!;
    const hours = dto.tempPasswordExpiresInHours ?? 72;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);

    const uniqueIds = [...new Set(dto.userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, companyId },
      include: {
        orgDepartment: { select: { name: true } },
        orgService: { select: { name: true } },
      },
    });
    const userById = new Map(users.map((u) => [u.id, u] as const));

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const companyName = company?.name ?? '';

    const resultByUserId = new Map<string, ActivatedCredentialDto>();
    let emailsSent = 0;
    let emailsFailed = 0;
    let alreadyActive = 0;

    const BATCH = 50;
    for (let b = 0; b < uniqueIds.length; b += BATCH) {
      const idChunk = uniqueIds.slice(b, b + BATCH);
      type Op = {
        userId: string;
        tempPassword: string;
        hash: string;
        whatsappLink?: string;
        row: (typeof users)[number];
      };
      const ops: Op[] = [];

      for (const id of idChunk) {
        const user = userById.get(id);
        if (!user) {
          resultByUserId.set(id, {
            userId: id,
            firstName: '',
            lastName: '',
            email: '',
            employeeId: '',
            tempPassword: '',
            status: 'error',
            errorMessage:
              'Collaborateur introuvable ou ne fait pas partie de votre entreprise',
          });
          continue;
        }

        if (user.role !== 'EMPLOYEE') {
          resultByUserId.set(id, {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId ?? '',
            tempPassword: '',
            status: 'error',
            errorMessage:
              'Seuls les comptes collaborateur peuvent être activés par ce flux',
          });
          continue;
        }

        if (user.isActive && !user.mustChangePassword) {
          resultByUserId.set(id, {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId ?? '',
            department: user.orgDepartment?.name,
            service: user.orgService?.name,
            tempPassword: '',
            status: 'already_active',
          });
          alreadyActive += 1;
          continue;
        }

        const tempPassword = generateTempPassword(
          user.firstName,
          user.employeeId ?? undefined,
        );
        const hash = await this.auth.hashPassword(tempPassword);

        let whatsappLink: string | undefined;
        if (dto.generateWhatsappLinks) {
          const msg = encodeURIComponent(
            `Bonjour ${user.firstName},\n\n` +
              `Votre espace PaySlip Manager est prêt !\n\n` +
              `Identifiants de connexion :\n` +
              `📧 Email : ${user.email}\n` +
              `🔑 Mot de passe : ${tempPassword}\n\n` +
              `⚠️ Ce mot de passe expire dans ${hours} h. Vous devrez le changer à la première connexion.\n\n` +
              `Téléchargez l'application et connectez-vous.` +
              (dto.customMessage?.trim()
                ? `\n\n${dto.customMessage.trim()}`
                : ''),
          );
          whatsappLink = `https://wa.me/?text=${msg}`;
        }

        ops.push({
          userId: user.id,
          tempPassword,
          hash,
          whatsappLink,
          row: user,
        });
      }

      if (ops.length > 0) {
        await this.prisma.$transaction(
          async (tx) => {
            for (const op of ops) {
              await tx.session.deleteMany({
                where: { userId: op.userId, deviceInfo: null },
              });
              await tx.user.update({
                where: { id: op.userId },
                data: {
                  isActive: true,
                  passwordHash: op.hash,
                  mustChangePassword: true,
                  tempPasswordExpiresAt: expiresAt,
                },
              });
            }
          },
          { timeout: 120_000, maxWait: 60_000 },
        );

        for (const op of ops) {
          const u = op.row;
          resultByUserId.set(op.userId, {
            userId: op.userId,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            employeeId: u.employeeId ?? '',
            department: u.orgDepartment?.name,
            service: u.orgService?.name,
            tempPassword: op.tempPassword,
            whatsappLink: op.whatsappLink,
            status: 'activated',
          });
        }
      }
    }

    const credentials = uniqueIds.map((id) => {
      const hit = resultByUserId.get(id);
      if (hit) {
        return hit;
      }
      return {
        userId: id,
        firstName: '',
        lastName: '',
        email: '',
        employeeId: '',
        tempPassword: '',
        status: 'error' as const,
        errorMessage: 'Traitement incomplet',
      };
    });

    const activatedRows = credentials.filter((c) => c.status === 'activated');
    const emailFailedUserIds: string[] = [];

    if (dto.sendMethod === 'email' && activatedRows.length > 0) {
      for (let i = 0; i < activatedRows.length; i += 20) {
        const chunk = activatedRows.slice(i, i + 20);
        const results = await Promise.allSettled(
          chunk.map((c) =>
            this.email.sendActivationEmail({
              to: c.email,
              firstName: c.firstName,
              lastName: c.lastName,
              employeeId: c.employeeId,
              tempPassword: c.tempPassword,
              companyName,
              expiresInHours: hours,
              customMessage: dto.customMessage,
            }),
          ),
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled') {
            emailsSent += 1;
          } else {
            emailsFailed += 1;
            emailFailedUserIds.push(chunk[j].userId);
          }
        }
        if (i + 20 < activatedRows.length) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1000);
          });
        }
      }
    }

    let pdfDownloadUrl: string | undefined;
    if (dto.sendMethod === 'pdf' && activatedRows.length > 0) {
      const buf = await buildCredentialsPdfBuffer(
        activatedRows.map((c) => ({
          status: c.status,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          employeeId: c.employeeId,
          tempPassword: c.tempPassword,
        })),
        companyName,
        expiresAt,
      );
      const key = `companies/${companyId}/temp/credentials_${Date.now()}.pdf`;
      await this.storage.uploadFileWithRetry(buf, key, 'application/pdf');
      pdfDownloadUrl = await this.storage.getPresignedUrl(key, 86400);
    }

    const activated = activatedRows.length;

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: USER_AUDIT.BULK_ACTIVATE,
        entityType: 'User',
        entityId: companyId,
        metadata: {
          total: uniqueIds.length,
          activated,
          emailsSent,
          emailsFailed,
          alreadyActive,
          sendMethod: dto.sendMethod,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      summary: {
        total: uniqueIds.length,
        activated,
        emailsSent,
        emailsFailed,
        alreadyActive,
      },
      credentials,
      pdfDownloadUrl,
      emailFailedUserIds:
        dto.sendMethod === 'email' && emailFailedUserIds.length > 0
          ? emailFailedUserIds
          : undefined,
    };
  }

  /**
   * Résout département / service à partir des champs DTO (UUID et/ou libellés).
   */
  private resolveImportOrgFromDtoRow(
    row: ImportRowDto,
    deptByNorm: Map<string, string>,
    serviceRows: ReadonlyArray<{
      id: string;
      name: string;
      departmentId: string | null;
    }>,
    deptIdSet: ReadonlySet<string>,
    serviceIdSet: ReadonlySet<string>,
  ):
    | {
        ok: true;
        departmentId?: string;
        serviceId?: string;
        departmentFreeText?: string;
      }
    | { ok: false; reason: string } {
    const serviceByNorm = new Map<
      string,
      { id: string; departmentId: string | null }
    >();
    const serviceById = new Map<
      string,
      { id: string; departmentId: string | null }
    >();
    for (const s of serviceRows) {
      serviceByNorm.set(this.normalizeImportOrgLabel(s.name), {
        id: s.id,
        departmentId: s.departmentId,
      });
      serviceById.set(s.id, {
        id: s.id,
        departmentId: s.departmentId,
      });
    }

    let departmentId = row.departmentId;
    let serviceId = row.serviceId;

    if (departmentId && !deptIdSet.has(departmentId)) {
      return {
        ok: false,
        reason: 'Département inconnu ou hors entreprise',
      };
    }

    const dn = row.departmentName?.trim() ?? '';
    if (!departmentId && dn) {
      const hit = deptByNorm.get(this.normalizeImportOrgLabel(dn));
      if (hit) {
        departmentId = hit;
      }
    }

    if (serviceId) {
      if (!serviceIdSet.has(serviceId)) {
        return { ok: false, reason: 'Service inconnu ou hors entreprise' };
      }
      const svc = serviceById.get(serviceId);
      if (!svc) {
        return { ok: false, reason: 'Service inconnu ou hors entreprise' };
      }
      if (svc.departmentId) {
        if (departmentId !== undefined && departmentId !== svc.departmentId) {
          return {
            ok: false,
            reason:
              'Département et service incohérents (ce service est rattaché à un autre département)',
          };
        }
        departmentId = svc.departmentId;
      }
    } else {
      const sn = row.serviceName?.trim() ?? '';
      if (sn) {
        const hit = serviceByNorm.get(this.normalizeImportOrgLabel(sn));
        if (!hit) {
          return {
            ok: false,
            reason:
              'Service inconnu (aucun service de l’entreprise ne correspond à ce libellé)',
          };
        }
        serviceId = hit.id;
        if (hit.departmentId) {
          if (
            departmentId !== undefined &&
            departmentId !== hit.departmentId
          ) {
            return {
              ok: false,
              reason:
                'Département et service incohérents (ce service est rattaché à un autre département)',
            };
          }
          departmentId = hit.departmentId;
        }
      }
    }

    const departmentFreeText = dn && !departmentId ? dn : undefined;
    return { ok: true, departmentId, serviceId, departmentFreeText };
  }
}
