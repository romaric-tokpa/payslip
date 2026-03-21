/* eslint-disable @typescript-eslint/no-unsafe-assignment -- matchers Jest */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import {
  FCM_SESSION_DEVICE_MARKER,
  NOTIFICATION_TYPES,
} from './notifications.constants';
import { hashFcmToken } from './notifications.fcm-hash';
import type { FcmMessaging } from './notifications.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    session: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    notification: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let configGet: jest.Mock;

  const sampleNotification: Notification = {
    id: 'notif-1',
    userId: 'user-1',
    title: 'T',
    message: 'M',
    type: 'PUSH',
    isRead: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    configGet = jest.fn().mockReturnValue('');
    prisma = {
      session: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('registerDevice', () => {
    it('crée une Session FCM si le jeton est nouveau', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });
      const token = 'new-fcm-token';
      await service.registerDevice('user-1', token);
      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tokenHash: hashFcmToken(token),
          deviceInfo: FCM_SESSION_DEVICE_MARKER,
        },
      });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: hashFcmToken(token),
          deviceInfo: FCM_SESSION_DEVICE_MARKER,
          ipAddress: token,
        }),
      });
    });

    it('met à jour ipAddress si la Session existe déjà', async () => {
      prisma.session.findFirst.mockResolvedValue({ id: 'sess-1' });
      prisma.session.update.mockResolvedValue({});
      const token = 'updated-token';
      await service.registerDevice('user-1', token);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'sess-1' },
        data: expect.objectContaining({ ipAddress: token }),
      });
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('sendPushToUser', () => {
    it('mode dégradé : crée la notification in-app sans appeler FCM', async () => {
      prisma.notification.create.mockResolvedValue(sampleNotification);
      const out = await service.sendPushToUser('user-1', 'Titre', 'Corps', {
        type: 'ALERT',
      });
      expect(out).toEqual(sampleNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Titre',
          message: 'Corps',
          type: 'ALERT',
        },
      });
      expect(prisma.session.findMany).not.toHaveBeenCalled();
    });

    it('avec FCM : envoie le push puis retourne la notification', async () => {
      const send = jest.fn().mockResolvedValue('message-id');
      const messaging: FcmMessaging = { send };
      service.setMessagingForTests(messaging, true);
      prisma.notification.create.mockResolvedValue(sampleNotification);
      prisma.session.findMany.mockResolvedValue([
        { id: 's1', ipAddress: 'fcmtoken-value' },
      ]);
      const out = await service.sendPushToUser('user-1', 'T', 'B', {
        payslipId: 'p1',
        type: NOTIFICATION_TYPES.NEW_PAYSLIP,
      });
      expect(out).toEqual(sampleNotification);
      expect(send).toHaveBeenCalledWith({
        token: 'fcmtoken-value',
        notification: { title: 'T', body: 'B' },
        data: { payslipId: 'p1', type: NOTIFICATION_TYPES.NEW_PAYSLIP },
      });
    });

    it('supprime la Session si le token FCM est invalide', async () => {
      const send = jest.fn().mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
      });
      service.setMessagingForTests({ send }, true);
      prisma.notification.create.mockResolvedValue(sampleNotification);
      prisma.session.findMany.mockResolvedValue([
        { id: 's-bad', ipAddress: 'bad-token' },
      ]);
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });
      await service.sendPushToUser('user-1', 'T', 'B');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 's-bad' },
      });
    });
  });

  describe('getNotifications', () => {
    it('retourne data + meta', async () => {
      prisma.notification.count.mockResolvedValue(2);
      prisma.notification.findMany.mockResolvedValue([
        sampleNotification,
        { ...sampleNotification, id: 'n2' },
      ]);
      const res = await service.getNotifications('user-1', 1, 20);
      expect(res.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(res.data).toHaveLength(2);
    });
  });

  describe('markAsRead', () => {
    it('succès', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        ...sampleNotification,
        userId: 'user-1',
      });
      prisma.notification.update.mockResolvedValue({
        ...sampleNotification,
        isRead: true,
      });
      const out = await service.markAsRead('notif-1', 'user-1');
      expect(out.isRead).toBe(true);
    });

    it('notification absente → NotFoundException', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(
        service.markAsRead('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('mauvais utilisateur → ForbiddenException', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        ...sampleNotification,
        userId: 'other-user',
      });
      await expect(
        service.markAsRead('notif-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getUnreadCount', () => {
    it('retourne le count', async () => {
      prisma.notification.count.mockResolvedValue(7);
      await expect(service.getUnreadCount('user-1')).resolves.toBe(7);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  describe('sendPushToMultipleUsers', () => {
    it('utilise Promise.allSettled (un échec ne bloque pas les autres)', async () => {
      prisma.notification.create
        .mockRejectedValueOnce(new Error('db fail'))
        .mockResolvedValueOnce(sampleNotification);
      await expect(
        service.sendPushToMultipleUsers(['u1', 'u2'], 'T', 'B'),
      ).resolves.toBeUndefined();
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendManualNotifications', () => {
    const rh: RequestUser = {
      id: 'rh-1',
      email: 'rh@x.com',
      role: 'RH_ADMIN',
      companyId: 'co-1',
    };

    it('non-RH → ForbiddenException', async () => {
      const emp: RequestUser = {
        id: 'e1',
        email: 'e@x.com',
        role: 'EMPLOYEE',
        companyId: 'co-1',
      };
      await expect(
        service.sendManualNotifications(emp, {
          title: 'x',
          message: 'y',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RH : envoie à la liste résolue', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      prisma.notification.create
        .mockResolvedValueOnce(sampleNotification)
        .mockResolvedValueOnce({ ...sampleNotification, id: 'n2' });
      await service.sendManualNotifications(rh, {
        title: 'Hello',
        message: 'World',
        userIds: ['e1', 'e2'],
      });
      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });
});
