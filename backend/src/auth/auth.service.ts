import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { EmploymentStatus, Prisma, User, UserRole } from '@prisma/client';
import type { ContractType } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { ActivateInvitationDto } from './dto/activate-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestUser } from './auth.types';
import { AUDIT, MAX_LOGIN_ATTEMPTS, SESSION_DEVICE } from './constants';
import {
  hashOpaqueToken,
  hashRefreshToken,
  newRefreshToken,
} from './auth.tokens';

export type AuthUserView = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string | null;
  /** Renseigné après inscription (auto-login). */
  companyName?: string | null;
  mustChangePassword: boolean;
  employmentStatus: EmploymentStatus;
  readOnlyUntil: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/** Ligne prête pour invitation groupée (import masse). */
export type BulkInviteEmployeeRow = {
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  department: string | null;
  departmentId: string | null;
  serviceId: string | null;
  position: string | null;
  contractType?: ContractType | null;
  /** ISO ou chaîne parsable côté service */
  contractEndDate?: string | null;
  entryDate?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds = 12;
  private readonly accessExpires: string;
  private readonly refreshDays: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    private readonly organization: OrganizationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    this.refreshDays = Number(this.config.get<string>('JWT_REFRESH_DAYS', '7'));
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.bcryptRounds);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.emailTaken(email)) {
      throw new ConflictException('Un compte avec cet e-mail existe déjà');
    }

    const companyNameTrim = dto.companyName.trim();
    const existingCompany = await this.prisma.company.findFirst({
      where: {
        name: { equals: companyNameTrim, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existingCompany) {
      throw new ConflictException(
        'Une entreprise avec ce nom existe déjà. Contactez votre administrateur si vous souhaitez rejoindre cette entreprise.',
      );
    }

    const passwordHash = await this.hashPassword(dto.password);
    const rccm = dto.rccm?.trim() || null;
    const phone = dto.companyPhone.trim();

    const { company, user } = await this.prisma.$transaction(async (tx) => {
      const co = await tx.company.create({
        data: {
          name: companyNameTrim,
          rccm,
          phone,
          readOnlyDaysAfterDeparture: 90,
        },
      });
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          position: dto.referentJobTitle.trim(),
          role: 'RH_ADMIN',
          companyId: co.id,
          employeeId: null,
          employmentStatus: 'ACTIVE',
          isActive: true,
          mustChangePassword: false,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: u.id,
          companyId: co.id,
          action: AUDIT.COMPANY_REGISTERED,
          entityType: 'Company',
          entityId: co.id,
          metadata: {
            companyName: co.name,
            adminEmail: u.email,
            referentJobTitle: u.position,
          } as Prisma.InputJsonValue,
        },
      });
      return { company: co, user: u };
    });

    const tokens = await this.generateTokens(
      user.id,
      user.role,
      user.email,
      user.companyId,
    );
    await this.persistRefreshSession(user.id, tokens.refreshToken);

    void this.email
      .sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        companyName: company.name,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `E-mail de bienvenue échoué pour ${user.email}: ${msg}`,
        );
      });

    return {
      user: {
        ...this.toAuthUserView(user),
        companyName: company.name,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const normalized = email.toLowerCase();
    const user = await this.users.findByEmail(normalized);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (
      user.tempPasswordExpiresAt &&
      new Date() > user.tempPasswordExpiresAt
    ) {
      throw new UnauthorizedException(
        'Votre mot de passe temporaire a expiré. Contactez votre RH pour obtenir un nouveau lien d\'activation.',
      );
    }

    if (user.employmentStatus === 'ARCHIVED') {
      throw new UnauthorizedException(
        'Votre compte a été archivé. Contactez votre ancien employeur.',
      );
    }

    if (user.role === 'EMPLOYEE' && user.employmentStatus === 'PENDING') {
      throw new UnauthorizedException(
        "Votre compte n'est pas encore activé. Utilisez le code d'activation reçu par e-mail.",
      );
    }

    if (user.role === 'EMPLOYEE' && user.employmentStatus === 'DEPARTED') {
      if (
        !user.readOnlyUntil ||
        new Date() > user.readOnlyUntil
      ) {
        throw new UnauthorizedException(
          'Votre accès a expiré. Vos bulletins ne sont plus consultables en ligne. ' +
            'Contactez votre ancien service RH pour obtenir vos documents.',
        );
      }
    } else if (!user.isActive) {
      throw new HttpException(
        'Compte verrouillé ou désactivé',
        HttpStatus.LOCKED,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId ?? undefined,
        action: AUDIT.LOGIN_SUCCESS,
        entityType: 'User',
        entityId: user.id,
      },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.role,
      user.email,
      user.companyId,
    );
    await this.persistRefreshSession(user.id, tokens.refreshToken);

    const userView = this.toAuthUserView(user);
    let companyName: string | null | undefined = userView.companyName;
    if (user.companyId) {
      const co = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { name: true },
      });
      companyName = co?.name ?? null;
    }

    return {
      user: { ...userView, companyName },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Connexion collaborateur (app mobile) : matricule + mot de passe.
   * Réservé au rôle EMPLOYEE. Si le matricule existe dans plusieurs entreprises,
   * la connexion est refusée (contacter les RH).
   */
  async loginEmployee(
    employeeIdRaw: string,
    password: string,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const trimmed = employeeIdRaw.trim();
    if (!trimmed) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const candidates =
      await this.users.findActiveEmployeesByEmployeeIdInsensitive(trimmed);

    if (candidates.length === 0) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (candidates.length > 1) {
      throw new UnauthorizedException(
        'Plusieurs comptes correspondent à ce matricule. Contactez les RH.',
      );
    }

    const user = candidates[0];

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (
      user.tempPasswordExpiresAt &&
      new Date() > user.tempPasswordExpiresAt
    ) {
      throw new UnauthorizedException(
        'Votre mot de passe temporaire a expiré. Contactez votre RH pour obtenir un nouveau lien d\'activation.',
      );
    }

    if (user.employmentStatus === 'ARCHIVED') {
      throw new UnauthorizedException(
        'Votre compte a été archivé. Contactez votre ancien employeur.',
      );
    }

    if (user.employmentStatus === 'PENDING') {
      throw new UnauthorizedException(
        "Votre compte n'est pas encore activé. Utilisez le code d'activation reçu par e-mail.",
      );
    }

    if (user.employmentStatus === 'DEPARTED') {
      if (
        !user.readOnlyUntil ||
        new Date() > user.readOnlyUntil
      ) {
        throw new UnauthorizedException(
          'Votre accès a expiré. Vos bulletins ne sont plus consultables en ligne. ' +
            'Contactez votre ancien service RH pour obtenir vos documents.',
        );
      }
    } else if (!user.isActive) {
      throw new HttpException(
        'Compte verrouillé ou désactivé',
        HttpStatus.LOCKED,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId ?? undefined,
        action: AUDIT.LOGIN_SUCCESS,
        entityType: 'User',
        entityId: user.id,
        metadata: { method: 'employee_matricule' } as Prisma.InputJsonValue,
      },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.role,
      user.email,
      user.companyId,
    );
    await this.persistRefreshSession(user.id, tokens.refreshToken);

    return {
      user: this.toAuthUserView(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const pepper = this.refreshPepper();
    const tokenHash = hashRefreshToken(refreshToken, pepper);

    /** Évite P2025 / 500 si deux refresh partent en parallèle (ex. React StrictMode). */
    const session = await this.prisma.$transaction(async (tx) => {
      const found = await tx.session.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date() },
          deviceInfo: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              companyId: true,
              isActive: true,
              employmentStatus: true,
              readOnlyUntil: true,
            },
          },
        },
      });

      if (!found) {
        return null;
      }
      const u = found.user;
      const allowRefresh =
        u.isActive ||
        (u.role === 'EMPLOYEE' &&
          u.employmentStatus === 'DEPARTED' &&
          u.readOnlyUntil != null &&
          new Date() <= u.readOnlyUntil);
      if (!allowRefresh) {
        return null;
      }

      const removed = await tx.session.deleteMany({
        where: { id: found.id, tokenHash },
      });

      if (removed.count !== 1) {
        return null;
      }

      return found;
    });

    if (!session) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const tokens = await this.generateTokens(
      session.user.id,
      session.user.role,
      session.user.email,
      session.user.companyId,
    );
    await this.persistRefreshSession(session.user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const pepper = this.refreshPepper();
    const tokenHash = hashRefreshToken(refreshToken, pepper);
    await this.prisma.session.deleteMany({
      where: { tokenHash, deviceInfo: null },
    });
  }

  async generateTokens(
    userId: string,
    role: UserRole,
    email: string,
    companyId: string | null,
    opts?: {
      impersonatedBy?: string;
      accessExpiresIn?: SignOptions['expiresIn'];
    },
  ): Promise<TokenPair> {
    const payload: Record<string, unknown> = {
      sub: userId,
      role,
      email,
      companyId,
    };
    if (opts?.impersonatedBy) {
      payload.impersonatedBy = opts.impersonatedBy;
    }
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn:
        opts?.accessExpiresIn ?? (this.accessExpires as SignOptions['expiresIn']),
    });
    const refreshToken = newRefreshToken();
    return { accessToken, refreshToken };
  }

  /**
   * Jetons de session pour le compte RH_ADMIN principal d’une entreprise,
   * avec revendication JWT `impersonatedBy` (audit SUPER_ADMIN_IMPERSONATE).
   */
  async impersonateCompanyRh(
    actor: RequestUser,
    companyId: string,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        companyId,
        role: 'RH_ADMIN',
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!admin) {
      throw new NotFoundException(
        'Aucun administrateur RH actif pour cette entreprise',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const tokens = await this.generateTokens(
      admin.id,
      admin.role,
      admin.email,
      admin.companyId,
      { impersonatedBy: actor.id, accessExpiresIn: '1h' },
    );
    await this.persistRefreshSession(admin.id, tokens.refreshToken);

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        companyId,
        action: AUDIT.SUPER_ADMIN_IMPERSONATE,
        entityType: 'User',
        entityId: admin.id,
        metadata: {
          targetEmail: admin.email,
          targetCompanyId: companyId,
          impersonatedUserId: admin.id,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      user: {
        ...this.toAuthUserView(admin),
        companyName: company?.name ?? null,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private refreshPepper(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private opaquePepper(): string {
    return this.refreshPepper();
  }

  /** Code numérique 6 chiffres ; unicité parmi les invitations non expirées. */
  private async issueUniqueActivationCode(): Promise<string> {
    const pepper = this.opaquePepper();
    const maxAttempts = 64;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const tokenHash = hashOpaqueToken(
        SESSION_DEVICE.INVITATION,
        code,
        pepper,
      );
      const clash = await this.prisma.session.findFirst({
        where: {
          tokenHash,
          deviceInfo: SESSION_DEVICE.INVITATION,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!clash) {
        return code;
      }
    }
    throw new ConflictException(
      'Impossible d’émettre un code d’activation, veuillez réessayer',
    );
  }

  private async issueUniqueActivationCodeTx(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const pepper = this.opaquePepper();
    const maxAttempts = 64;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const tokenHash = hashOpaqueToken(
        SESSION_DEVICE.INVITATION,
        code,
        pepper,
      );
      const clash = await tx.session.findFirst({
        where: {
          tokenHash,
          deviceInfo: SESSION_DEVICE.INVITATION,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!clash) {
        return code;
      }
    }
    throw new ConflictException(
      'Impossible d’émettre un code d’activation, veuillez réessayer',
    );
  }

  private async persistRefreshSession(
    userId: string,
    refreshTokenPlain: string,
  ): Promise<void> {
    const tokenHash = hashRefreshToken(refreshTokenPlain, this.refreshPepper());
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshDays);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        deviceInfo: null,
      },
    });
  }

  async inviteEmployee(
    dto: InviteEmployeeDto,
    inviter: RequestUser,
  ): Promise<{ activationCode: string; activationUrl: string }> {
    if (inviter.role !== 'RH_ADMIN') {
      throw new ForbiddenException(
        'Seul un administrateur RH peut inviter un collaborateur',
      );
    }
    if (!inviter.companyId) {
      throw new ForbiddenException(
        'Compte administrateur sans entreprise associée',
      );
    }

    const email = dto.email.toLowerCase();
    if (await this.users.emailTaken(email)) {
      throw new ConflictException('Cet e-mail est déjà utilisé');
    }

    await this.organization.assertOrgAssignment(
      inviter.companyId,
      dto.departmentId ?? null,
      dto.serviceId ?? null,
    );

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await this.hashPassword(tempPassword);
    const activationCode = await this.issueUniqueActivationCode();
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.INVITATION,
      activationCode,
      this.opaquePepper(),
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    let departmentLabel = dto.department?.trim() || null;
    if (dto.departmentId) {
      const d = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: inviter.companyId },
        select: { name: true },
      });
      departmentLabel = d?.name ?? departmentLabel;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            employeeId: dto.employeeId,
            department: departmentLabel,
            departmentId: dto.departmentId ?? null,
            serviceId: dto.serviceId ?? null,
            position: dto.position ?? null,
            role: 'EMPLOYEE',
            companyId: inviter.companyId,
            passwordHash,
            isActive: false,
            employmentStatus: 'PENDING',
            contractType: dto.contractType ?? null,
            contractEndDate: dto.contractEndDate
              ? new Date(dto.contractEndDate)
              : null,
            entryDate: dto.entryDate ? new Date(dto.entryDate) : null,
          },
        });

        await tx.session.create({
          data: {
            userId: user.id,
            tokenHash,
            deviceInfo: SESSION_DEVICE.INVITATION,
            expiresAt,
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'E-mail ou matricule déjà utilisé pour cette entreprise',
        );
      }
      throw e;
    }

    return {
      activationCode,
      activationUrl: `/activate?code=${activationCode}`,
    };
  }

  /**
   * Invitations groupées (import masse) : lots transactionnels, un seul hash bcrypt par lot.
   * L’affectation org est déjà validée côté UsersService.
   */
  async createInvitedEmployeesBulk(
    rows: BulkInviteEmployeeRow[],
    inviter: RequestUser,
    options?: { batchSize?: number; transactionTimeoutMs?: number },
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    if (inviter.role !== 'RH_ADMIN') {
      throw new ForbiddenException(
        'Seul un administrateur RH peut inviter un collaborateur',
      );
    }
    if (!inviter.companyId) {
      throw new ForbiddenException(
        'Compte administrateur sans entreprise associée',
      );
    }
    const companyId = inviter.companyId;
    const batchSize = Math.max(1, options?.batchSize ?? 50);
    const transactionTimeoutMs = options?.transactionTimeoutMs ?? 120_000;
    const pepper = this.opaquePepper();
    const expiresAtBase = new Date();
    expiresAtBase.setHours(expiresAtBase.getHours() + 72);

    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const tempPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await this.hashPassword(tempPassword);

      await this.prisma.$transaction(
        async (tx) => {
          for (const dto of slice) {
            const email = dto.email.toLowerCase();
            const activationCode = await this.issueUniqueActivationCodeTx(tx);
            const tokenHash = hashOpaqueToken(
              SESSION_DEVICE.INVITATION,
              activationCode,
              pepper,
            );
            const user = await tx.user.create({
              data: {
                email,
                firstName: dto.firstName,
                lastName: dto.lastName,
                employeeId: dto.employeeId,
                department: dto.department,
                departmentId: dto.departmentId,
                serviceId: dto.serviceId,
                position: dto.position,
                role: 'EMPLOYEE',
                companyId,
                passwordHash,
                isActive: false,
                employmentStatus: 'PENDING',
                contractType: dto.contractType ?? null,
                contractEndDate: dto.contractEndDate
                  ? new Date(dto.contractEndDate)
                  : null,
                entryDate: dto.entryDate ? new Date(dto.entryDate) : null,
              },
            });
            await tx.session.create({
              data: {
                userId: user.id,
                tokenHash,
                deviceInfo: SESSION_DEVICE.INVITATION,
                expiresAt: expiresAtBase,
              },
            });
          }
        },
        {
          timeout: transactionTimeoutMs,
          maxWait: 60_000,
        },
      );
    }
  }

  /**
   * Émet un nouveau code d’activation (72 h) pour un collaborateur encore inactif.
   * Les codes précédents (même type) sont révoqués — le clair n’est jamais stocké en base.
   */
  async regenerateEmployeeInvitation(
    employeeUserId: string,
    inviter: RequestUser,
  ): Promise<{ activationCode: string; activationUrl: string }> {
    if (inviter.role !== 'RH_ADMIN') {
      throw new ForbiddenException(
        'Seul un administrateur RH peut régénérer un code d’activation',
      );
    }
    if (!inviter.companyId) {
      throw new ForbiddenException(
        'Compte administrateur sans entreprise associée',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: employeeUserId, companyId: inviter.companyId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.role !== 'EMPLOYEE') {
      throw new BadRequestException(
        'Seuls les comptes collaborateur peuvent recevoir un code d’activation',
      );
    }
    if (user.isActive) {
      throw new BadRequestException(
        'Ce compte est déjà activé : le collaborateur doit se connecter avec son mot de passe.',
      );
    }
    if (user.employmentStatus !== 'PENDING') {
      throw new BadRequestException(
        'Seuls les collaborateurs en attente d’activation peuvent recevoir un nouveau code.',
      );
    }

    const activationCode = await this.issueUniqueActivationCode();
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.INVITATION,
      activationCode,
      this.opaquePepper(),
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: {
          userId: user.id,
          deviceInfo: SESSION_DEVICE.INVITATION,
        },
      });
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash,
          deviceInfo: SESSION_DEVICE.INVITATION,
          expiresAt,
        },
      });
    });

    return {
      activationCode,
      activationUrl: `/activate?code=${activationCode}`,
    };
  }

  async activateInvitation(
    dto: ActivateInvitationDto,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const code = dto.activationCode.replace(/\s/g, '');
    const normalized = code.padStart(6, '0');
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.INVITATION,
      normalized,
      this.opaquePepper(),
    );

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        deviceInfo: SESSION_DEVICE.INVITATION,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Code d’activation invalide ou expiré');
    }

    const { user } = session;
    if (user.role !== 'EMPLOYEE' || user.isActive) {
      throw new UnauthorizedException('Code d’activation invalide ou expiré');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: session.id } });
      return tx.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          employmentStatus: 'ACTIVE',
          passwordHash,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
        },
      });
    });

    const tokens = await this.generateTokens(
      updated.id,
      updated.role,
      updated.email,
      updated.companyId,
    );
    await this.persistRefreshSession(updated.id, tokens.refreshToken);

    return {
      user: this.toAuthUserView(updated),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    resetToken?: string;
    resetUrl?: string;
  }> {
    const email = dto.email.toLowerCase();
    const user = await this.users.findByEmail(email);
    const message =
      'Si un compte actif existe pour cet e-mail, des instructions de réinitialisation ont été préparées.';

    if (!user?.isActive) {
      return { message };
    }

    await this.prisma.session.deleteMany({
      where: {
        userId: user.id,
        deviceInfo: SESSION_DEVICE.PASSWORD_RESET,
      },
    });

    const resetToken = crypto.randomUUID();
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.PASSWORD_RESET,
      resetToken,
      this.opaquePepper(),
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceInfo: SESSION_DEVICE.PASSWORD_RESET,
        expiresAt,
      },
    });

    this.logger.debug(`Jeton reset (dev) pour ${email} : ${resetToken}`);

    return {
      message,
      resetToken,
      resetUrl: `/reset-password?token=${resetToken}`,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.PASSWORD_RESET,
      dto.resetToken,
      this.opaquePepper(),
    );

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        deviceInfo: SESSION_DEVICE.PASSWORD_RESET,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException(
        'Lien de réinitialisation invalide ou expiré',
      );
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: session.id } });
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
        },
      });
    });

    return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
  }

  async changePassword(
    actor: RequestUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, passwordHash: true, isActive: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException();
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        companyId: actor.companyId ?? undefined,
        action: AUDIT.PASSWORD_CHANGED,
        entityType: 'User',
        entityId: actor.id,
      },
    });
    return { message: 'Mot de passe mis à jour.' };
  }

  /**
   * Sessions de navigation (refresh JWT) encore valides pour cet utilisateur.
   * Les lignes avec `deviceInfo` non nul (invitation, reset mot de passe, etc.) sont exclues.
   */
  async listMyRefreshSessions(actor: RequestUser) {
    const now = new Date();
    return this.prisma.session.findMany({
      where: {
        userId: actor.id,
        expiresAt: { gt: now },
        deviceInfo: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeRefreshSession(
    actor: RequestUser,
    sessionId: string,
  ): Promise<void> {
    const removed = await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId: actor.id,
        deviceInfo: null,
      },
    });
    if (removed.count === 0) {
      throw new NotFoundException('Session introuvable ou déjà expirée');
    }
  }

  private toAuthUserView(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
      mustChangePassword: user.mustChangePassword,
      employmentStatus: user.employmentStatus,
      readOnlyUntil: user.readOnlyUntil
        ? user.readOnlyUntil.toISOString()
        : null,
    };
  }

  private async recordFailedLogin(user: User): Promise<void> {
    const lastSuccess = await this.prisma.auditLog.findFirst({
      where: { userId: user.id, action: AUDIT.LOGIN_SUCCESS },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const since = lastSuccess?.createdAt ?? user.createdAt;

    const failedCount = await this.prisma.auditLog.count({
      where: {
        userId: user.id,
        action: AUDIT.LOGIN_FAILED,
        createdAt: { gte: since },
      },
    });

    const next = failedCount + 1;

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId ?? undefined,
        action: AUDIT.LOGIN_FAILED,
        entityType: 'User',
        entityId: user.id,
        metadata: { attempt: next } as Prisma.InputJsonValue,
      },
    });

    if (next >= MAX_LOGIN_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });
      this.logger.warn(
        `Compte verrouillé après ${MAX_LOGIN_ATTEMPTS} échecs: ${user.email}`,
      );
    }
  }
}
