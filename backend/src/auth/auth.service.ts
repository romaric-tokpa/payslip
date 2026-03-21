import * as crypto from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { Prisma, User, UserRole } from '@prisma/client';
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
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
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
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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
    const email = dto.email.toLowerCase();
    if (await this.users.emailTaken(email)) {
      throw new ConflictException('Cet e-mail est déjà utilisé');
    }
    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          siret: dto.companySiret ?? null,
        },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'RH_ADMIN',
          companyId: company.id,
          employeeId: null,
        },
      });
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

  async login(
    email: string,
    password: string,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const normalized = email.toLowerCase();
    const user = await this.users.findByEmail(normalized);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.isActive) {
      throw new HttpException(
        'Compte verrouillé ou désactivé',
        HttpStatus.LOCKED,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
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

    return {
      user: this.toAuthUserView(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const pepper = this.refreshPepper();
    const tokenHash = hashRefreshToken(refreshToken, pepper);

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        deviceInfo: null,
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    await this.prisma.session.delete({ where: { id: session.id } });

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
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, email, companyId },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.accessExpires as SignOptions['expiresIn'],
      },
    );
    const refreshToken = newRefreshToken();
    return { accessToken, refreshToken };
  }

  private refreshPepper(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private opaquePepper(): string {
    return this.refreshPepper();
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
  ): Promise<{ invitationToken: string; invitationUrl: string }> {
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

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await this.hashPassword(tempPassword);
    const invitationToken = crypto.randomUUID();
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.INVITATION,
      invitationToken,
      this.opaquePepper(),
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            employeeId: dto.employeeId,
            department: dto.department ?? null,
            position: dto.position ?? null,
            role: 'EMPLOYEE',
            companyId: inviter.companyId,
            passwordHash,
            isActive: false,
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
      invitationToken,
      invitationUrl: `/activate?token=${invitationToken}`,
    };
  }

  async activateInvitation(
    dto: ActivateInvitationDto,
  ): Promise<{ user: AuthUserView } & TokenPair> {
    const tokenHash = hashOpaqueToken(
      SESSION_DEVICE.INVITATION,
      dto.invitationToken,
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
      throw new UnauthorizedException('Invitation invalide ou expirée');
    }

    const { user } = session;
    if (user.role !== 'EMPLOYEE' || user.isActive) {
      throw new UnauthorizedException('Invitation invalide ou expirée');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: session.id } });
      return tx.user.update({
        where: { id: user.id },
        data: { isActive: true, passwordHash },
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
        data: { passwordHash },
      });
    });

    return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
  }

  private toAuthUserView(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
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
