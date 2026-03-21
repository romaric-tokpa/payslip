import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestUser } from './auth.types';
import { Throttle } from '../common/decorators/throttle.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import {
  ActivateInvitationDto,
  ForgotPasswordDto,
  InviteEmployeeDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Inscription admin RH + création entreprise' })
  @ApiCreatedResponse({
    description: 'Compte et entreprise créés',
    schema: {
      example: {
        accessToken: '…',
        refreshToken: '…',
        user: {
          id: 'uuid',
          email: 'rh@entreprise.com',
          firstName: 'Awa',
          lastName: 'Diallo',
          role: 'RH_ADMIN',
          companyId: 'uuid',
        },
      },
    },
  })
  @ApiConflictResponse({ description: 'E-mail déjà utilisé' })
  @ApiBadRequestResponse({
    description: 'Validation des champs (ex. mot de passe < 8 caractères)',
  })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('RH_ADMIN')
  @ApiOperation({
    summary: 'Inviter un collaborateur (compte inactif jusqu’à activation)',
    description:
      'Crée un employé `EMPLOYEE` avec mot de passe temporaire et un jeton d’invitation (72 h) en `Session`.',
  })
  @ApiCreatedResponse({
    description: 'Jeton d’invitation émis (envoi e-mail à brancher plus tard)',
    schema: {
      example: {
        invitationToken: '550e8400-e29b-41d4-a716-446655440000',
        invitationUrl: '/activate?token=550e8400-e29b-41d4-a716-446655440000',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Rôle autre que RH_ADMIN' })
  @ApiConflictResponse({ description: 'E-mail ou matricule déjà utilisé' })
  @ApiBadRequestResponse({ description: 'Validation' })
  async invite(
    @Body() dto: InviteEmployeeDto,
    @CurrentUser() inviter: RequestUser,
  ) {
    return this.auth.inviteEmployee(dto, inviter);
  }

  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activer le compte collaborateur (première connexion)',
    description:
      'Consomme le jeton d’invitation et définit le mot de passe définitif.',
  })
  @ApiOkResponse({
    description: 'Compte activé, session ouverte',
    schema: {
      example: {
        accessToken: '…',
        refreshToken: '…',
        user: {
          id: 'uuid',
          email: 'collab@entreprise.com',
          firstName: 'Fatou',
          lastName: 'Koné',
          role: 'EMPLOYEE',
          companyId: 'uuid',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Jeton d’invitation invalide ou expiré',
  })
  @ApiBadRequestResponse({
    description: 'Validation (ex. mot de passe < 8 caractères)',
  })
  async activate(@Body() dto: ActivateInvitationDto) {
    return this.auth.activateInvitation(dto);
  }

  @Public()
  @Throttle(5, 60)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion (JWT 15 min + refresh 7 j)' })
  @ApiOkResponse({
    description: 'Tokens émis',
    schema: {
      example: {
        accessToken: '…',
        refreshToken: '…',
        user: {
          id: 'uuid',
          email: 'rh@entreprise.com',
          firstName: 'Awa',
          lastName: 'Diallo',
          role: 'RH_ADMIN',
          companyId: 'uuid',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Identifiants invalides' })
  @ApiResponse({
    status: 423,
    description: 'Compte verrouillé ou désactivé',
  })
  @ApiBadRequestResponse({ description: 'Corps de requête invalide' })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Throttle(5, 60)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander une réinitialisation de mot de passe',
    description:
      'Si le compte est actif, enregistre un jeton (1 h) en `Session`. Les champs `resetToken` / `resetUrl` sont renvoyés pour les tests jusqu’à l’envoi d’e-mails.',
  })
  @ApiOkResponse({
    description:
      'Réponse uniforme ; jetons présents seulement si compte actif trouvé',
    schema: {
      example: {
        message:
          'Si un compte actif existe pour cet e-mail, des instructions de réinitialisation ont été préparées.',
        resetToken: '550e8400-e29b-41d4-a716-446655440000',
        resetUrl: '/reset-password?token=550e8400-e29b-41d4-a716-446655440000',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Définir un nouveau mot de passe via jeton' })
  @ApiOkResponse({
    description: 'Mot de passe mis à jour',
    schema: {
      example: {
        message: 'Mot de passe mis à jour. Vous pouvez vous connecter.',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Jeton invalide ou expiré' })
  @ApiBadRequestResponse({ description: 'Validation' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir la paire de tokens' })
  @ApiOkResponse({
    description: 'Nouveaux tokens',
    schema: {
      example: { accessToken: '…', refreshToken: '…' },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalide ou expiré' })
  @ApiBadRequestResponse({ description: 'Corps de requête invalide' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoque le refresh token côté serveur' })
  @ApiResponse({ status: 204, description: 'Refresh token révoqué' })
  @ApiBadRequestResponse({ description: 'Corps de requête invalide' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
