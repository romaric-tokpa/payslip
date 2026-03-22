/**
 * Stockage temporaire des lots « analyze-bulk » avant `confirm-bulk`.
 *
 * **Limite prod :** les PDF sont tenus en RAM sur ce processus (TTL 30 min).
 * Ex. 200 × 5 Mo ≈ 1 Go par session — acceptable en dev / instance unique,
 * risqué à charge ou avec plusieurs réplicas (session non partagée).
 *
 * **Pistes plus tard :** (1) préfixes `temp/` sur S3 + lifecycle de suppression
 * (~1 h) et clés de session en base ou dans le JWT ; (2) Redis avec buffers
 * ou métadonnées + clés `EX` / TTL aligné sur la confirmation.
 */
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

const TTL_MS = 30 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

export type PayslipBulkStoredFile = {
  fileIndex: number;
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type PayslipBulkSession = {
  id: string;
  companyId: string;
  adminUserId: string;
  files: PayslipBulkStoredFile[];
  expiresAt: number;
};

@Injectable()
export class PayslipBulkTempStore implements OnModuleDestroy {
  private readonly logger = new Logger(PayslipBulkTempStore.name);
  private readonly sessions = new Map<string, PayslipBulkSession>();
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweepExpired(), SWEEP_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
    this.sessions.clear();
  }

  createSession(
    companyId: string,
    adminUserId: string,
    files: PayslipBulkStoredFile[],
  ): string {
    const id = randomUUID();
    const session: PayslipBulkSession = {
      id,
      companyId,
      adminUserId,
      files,
      expiresAt: Date.now() + TTL_MS,
    };
    this.sessions.set(id, session);
    return id;
  }

  getSession(batchId: string): PayslipBulkSession | undefined {
    const s = this.sessions.get(batchId);
    if (!s) {
      return undefined;
    }
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(batchId);
      return undefined;
    }
    return s;
  }

  consumeSession(batchId: string): PayslipBulkSession | undefined {
    const s = this.getSession(batchId);
    if (s) {
      this.sessions.delete(batchId);
    }
    return s;
  }

  deleteSession(batchId: string): void {
    this.sessions.delete(batchId);
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, s] of this.sessions) {
      if (now > s.expiresAt) {
        this.sessions.delete(key);
        this.logger.debug(`Expired bulk session removed: ${key}`);
      }
    }
  }
}
