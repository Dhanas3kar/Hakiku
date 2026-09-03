import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        const statusCode = response?.statusCode || 200;
        this.metricsService.recordHttpRequest(statusCode, durationMs);
      }),
      catchError((err) => {
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        const statusCode = err?.status || err?.statusCode || 500;
        this.metricsService.recordHttpRequest(statusCode, durationMs);
        throw err;
      }),
    );
  }
}
