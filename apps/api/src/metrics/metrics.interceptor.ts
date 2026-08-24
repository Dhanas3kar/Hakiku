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

    return next.handle().pipe(
      tap(() => {
        this.metricsService.recordHttpRequest(response.statusCode);
      }),
      catchError((err) => {
        const statusCode = err.status || 500;
        this.metricsService.recordHttpRequest(statusCode);
        throw err;
      }),
    );
  }
}
