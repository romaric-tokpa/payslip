import {
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReplaySubject, Observable } from 'rxjs';
import type { RequestUser } from '../auth/auth.types';
import type {
  ImportEmployeesReport,
  ImportProgressEvent,
} from './users-import.types';

type JobMeta = {
  companyId: string;
  userId: string;
  subject: ReplaySubject<MessageEvent>;
};

@Injectable()
export class UserImportJobService {
  private readonly jobs = new Map<string, JobMeta>();

  createJob(admin: RequestUser): string {
    if (admin.role !== 'RH_ADMIN' || !admin.companyId) {
      throw new ForbiddenException();
    }
    const jobId = randomUUID();
    const subject = new ReplaySubject<MessageEvent>(300);
    this.jobs.set(jobId, {
      companyId: admin.companyId,
      userId: admin.id,
      subject,
    });
    return jobId;
  }

  private getJobOrThrow(jobId: string): JobMeta {
    const j = this.jobs.get(jobId);
    if (!j) {
      throw new NotFoundException('Import introuvable ou expiré');
    }
    return j;
  }

  assertCanSubscribe(jobId: string, user: RequestUser): void {
    const j = this.getJobOrThrow(jobId);
    if (user.role !== 'RH_ADMIN' || user.companyId !== j.companyId) {
      throw new ForbiddenException();
    }
    if (user.id !== j.userId) {
      throw new ForbiddenException();
    }
  }

  stream(jobId: string, user: RequestUser): Observable<MessageEvent> {
    this.assertCanSubscribe(jobId, user);
    return this.getJobOrThrow(jobId).subject.asObservable();
  }

  pushEvent(jobId: string, event: ImportProgressEvent): void {
    const j = this.jobs.get(jobId);
    if (!j) {
      return;
    }
    j.subject.next({ data: JSON.stringify(event) } as MessageEvent);
  }

  finishSuccess(jobId: string, report: ImportEmployeesReport): void {
    const j = this.jobs.get(jobId);
    if (!j) {
      return;
    }
    j.subject.next({
      data: JSON.stringify({
        kind: 'done',
        report,
      } satisfies ImportProgressEvent),
    } as MessageEvent);
    j.subject.complete();
    this.scheduleCleanup(jobId);
  }

  finishError(jobId: string, err: unknown): void {
    const j = this.jobs.get(jobId);
    if (!j) {
      return;
    }
    const message =
      err instanceof Error ? err.message : 'Import impossible';
    j.subject.next({
      data: JSON.stringify({
        kind: 'error',
        message,
      } satisfies ImportProgressEvent),
    } as MessageEvent);
    j.subject.complete();
    this.scheduleCleanup(jobId);
  }

  private scheduleCleanup(jobId: string): void {
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 10 * 60_000);
  }
}
