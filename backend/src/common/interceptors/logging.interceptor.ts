import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { RequestUser } from '../../auth/auth.types';

type AuthedRequest = Request & { user?: RequestUser };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();
    const { method, originalUrl } = req;
    const userId = req.user?.id;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          `${method} ${originalUrl} userId=${userId ?? 'anonymous'} ${ms}ms ${res.statusCode}`,
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        const status = err instanceof HttpException ? err.getStatus() : 500;
        this.logger.log(
          `${method} ${originalUrl} userId=${userId ?? 'anonymous'} ${ms}ms ${status}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
