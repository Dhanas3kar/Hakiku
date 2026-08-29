import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    
    const correlationId = randomUUID();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || 'Http Error';
      details = typeof res === 'object' ? (res as any).error : null;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`[${correlationId}] Unhandled Exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`[${correlationId}] Unknown Exception`, JSON.stringify(exception));
    }

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] HTTP ${status} Error on ${request.method} ${request.url}`,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] HTTP ${status} Warning on ${request.method} ${request.url}: ${message}`,
      );
    }

    response.status(status).send({
      statusCode: status,
      message,
      error: details,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
