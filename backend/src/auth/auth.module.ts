import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OrganizationModule } from '../organization/organization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { CompanyScopeGuard } from '../common/guards/company-scope.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './guards/must-change-password.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    OrganizationModule,
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_EXPIRES',
            '15m',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    MustChangePasswordGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: CompanyScopeGuard },
    // Optionnel : ajouter `{ provide: APP_GUARD, useClass: RolesGuard }` pour appliquer `@Roles()` sans `@UseGuards(RolesGuard)`.
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
    RolesGuard,
    MustChangePasswordGuard,
  ],
})
export class AuthModule {}
