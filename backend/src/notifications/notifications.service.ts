import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ServiceAccount } from 'firebase-admin';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { SendNotificationDto } from './dto/send-notification.dto';
import {
  FCM_SESSION_DEVICE_MARKER,
  FCM_SESSION_EXPIRES_AT,
  NOTIFICATION_TYPES,
} from './notifications.constants';
import { hashFcmToken } from './notifications.fcm-hash';

type FirebaseAdminModule = typeof import('firebase-admin');

/** Sous-ensemble utilisé pour les tests (mock). */
export type FcmMessaging = {
  send: (message: {
    token: string;
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => Promise<string>;
};

function isInvalidFcmTokenError(e: unknown): boolean {
  const code =
    e &&
    typeof e === 'object' &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
      ? (e as { code: string }).code
      : '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

function toFcmData(
  data?: Record<string, string>,
): Record<string, string> | undefined {
  if (data == null || Object.keys(data).length === 0) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = String(v);
  }
  return out;
}

export type PaginatedNotifications = {
  data: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private messaging: FcmMessaging | null = null;
  private pushEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.initFirebase();
  }

  /** Initialise Firebase Admin (push). Sans `FIREBASE_SERVICE_ACCOUNT_PATH`, mode dégradé (in-app uniquement). */
  initFirebase(): void {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    const p = raw?.trim();
    if (!p) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_PATH non défini — notifications push FCM désactivées (in-app uniquement)',
      );
      this.pushEnabled = false;
      this.messaging = null;
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement conditionnel + tests mock
      const admin = require('firebase-admin') as FirebaseAdminModule;
      const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
      const json = fs.readFileSync(abs, 'utf8');
      const sa = JSON.parse(json) as ServiceAccount;
      if (!admin.apps?.length) {
        admin.initializeApp({
          credential: admin.credential.cert(sa),
        });
      }
      this.messaging = admin.messaging() as FcmMessaging;
      this.pushEnabled = true;
      this.logger.log('Firebase Admin initialisé (FCM actif)');
    } catch (e) {
      this.logger.warn(
        `Échec init Firebase — mode dégradé (in-app uniquement) : ${e instanceof Error ? e.message : String(e)}`,
      );
      this.pushEnabled = false;
      this.messaging = null;
    }
  }

  /** Exposé pour les tests (forcer l’état messaging). */
  setMessagingForTests(messaging: FcmMessaging | null, enabled: boolean): void {
    this.messaging = messaging;
    this.pushEnabled = enabled;
  }

  isPushEnabled(): boolean {
    return this.pushEnabled && this.messaging != null;
  }

  async registerDevice(
    userId: string,
    fcmToken: string,
    deviceInfo?: string,
  ): Promise<void> {
    if (deviceInfo != null && deviceInfo.trim() !== '') {
      this.logger.debug(
        `Enregistrement FCM (indication appareil) : ${deviceInfo.trim()}`,
      );
    }
    const tokenHash = hashFcmToken(fcmToken);
    const existing = await this.prisma.session.findFirst({
      where: {
        userId,
        tokenHash,
        deviceInfo: FCM_SESSION_DEVICE_MARKER,
      },
    });
    if (existing) {
      await this.prisma.session.update({
        where: { id: existing.id },
        data: {
          ipAddress: fcmToken,
          expiresAt: FCM_SESSION_EXPIRES_AT,
        },
      });
      return;
    }
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        deviceInfo: FCM_SESSION_DEVICE_MARKER,
        ipAddress: fcmToken,
        expiresAt: FCM_SESSION_EXPIRES_AT,
      },
    });
  }

  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<Notification> {
    const type =
      data?.type != null && data.type.length > 0
        ? data.type
        : NOTIFICATION_TYPES.PUSH;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message: body,
        type,
      },
    });

    if (!this.pushEnabled || this.messaging == null) {
      return notification;
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        deviceInfo: FCM_SESSION_DEVICE_MARKER,
        ipAddress: { not: null },
      },
      select: { id: true, ipAddress: true },
    });

    const fcmPayload = toFcmData(data);

    for (const s of sessions) {
      const token = s.ipAddress;
      if (token == null || token.length === 0) {
        continue;
      }
      try {
        await this.messaging.send({
          token,
          notification: { title, body },
          data: fcmPayload,
        });
      } catch (e: unknown) {
        if (isInvalidFcmTokenError(e)) {
          await this.prisma.session.deleteMany({ where: { id: s.id } });
          this.logger.warn(`Session FCM supprimée (token invalide) : ${s.id}`);
        } else {
          this.logger.warn(
            `Envoi FCM échoué pour l’utilisateur ${userId} : ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    return notification;
  }

  async sendPushToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((id) => this.sendPushToUser(id, title, body, data)),
    );
  }

  async getNotifications(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedNotifications> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const where = { userId };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 0,
      },
    };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (n == null) {
      throw new NotFoundException();
    }
    if (n.userId !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async sendManualNotifications(
    actor: RequestUser,
    dto: SendNotificationDto,
  ): Promise<void> {
    if (actor.role !== 'RH_ADMIN' || actor.companyId == null) {
      throw new ForbiddenException();
    }
    const targets = await this.resolveTargetEmployeeIds(
      actor.companyId,
      dto.userIds,
    );
    await this.sendPushToMultipleUsers(targets, dto.title, dto.message, {
      type: NOTIFICATION_TYPES.MANUAL,
    });
  }

  private async resolveTargetEmployeeIds(
    companyId: string,
    userIds?: string[],
  ): Promise<string[]> {
    if (userIds != null && userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          companyId,
          role: 'EMPLOYEE',
          isActive: true,
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    const all = await this.prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE', isActive: true },
      select: { id: true },
    });
    return all.map((u) => u.id);
  }
}
