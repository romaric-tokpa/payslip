import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  QueryNotificationsDto,
  RegisterDeviceDto,
  SendNotificationDto,
} from './dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('register-device')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enregistrer ou mettre à jour le jeton FCM du terminal',
    description:
      'Stocke le jeton dans `Session` (deviceInfo=FCM_TOKEN, tokenHash=hash, ipAddress=jeton en clair).',
  })
  @ApiBody({ type: RegisterDeviceDto })
  @ApiUnauthorizedResponse()
  async registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<void> {
    await this.notifications.registerDevice(
      user.id,
      dto.fcmToken,
      dto.deviceInfo,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedResponse()
  async getUnreadCount(
    @CurrentUser() user: RequestUser,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notifications.getUnreadCount(user.id);
    return { count };
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des notifications du titulaire' })
  @ApiOkResponse({
    description: 'data + meta pagination',
    schema: {
      example: {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse()
  async list(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryNotificationsDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.notifications.getNotifications(user.id, page, limit);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiOkResponse({ description: 'Notification mise à jour' })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse({ description: 'Notification d’un autre utilisateur' })
  @ApiUnauthorizedResponse()
  async markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markAsRead(id, user.id);
  }

  @Post('send')
  @Roles('RH_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoi manuel (push + in-app)',
    description:
      'Si `userIds` est absent ou vide : tous les collaborateurs actifs de l’entreprise.',
  })
  @ApiBody({ type: SendNotificationDto })
  @ApiOkResponse({
    description: 'Notifications créées / envois traités (allSettled)',
  })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  async send(
    @CurrentUser() actor: RequestUser,
    @Body() dto: SendNotificationDto,
  ): Promise<void> {
    await this.notifications.sendManualNotifications(actor, dto);
  }
}
