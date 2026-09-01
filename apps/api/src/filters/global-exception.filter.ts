import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  private mapStatusToCode(status: number, exception: any): string {
    if (status === 400) {
      if (exception?.response?.message && Array.isArray(exception.response.message)) {
        return 'VALIDATION_ERROR';
      }
      return 'BAD_REQUEST';
    }
    if (status === 401) return 'AUTH_FAILED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 413) return 'PAYLOAD_TOO_LARGE';
    if (status === 429) return 'RATE_LIMITED';
    if (status === 503) return 'SERVICE_UNAVAILABLE';
    return 'INTERNAL_ERROR';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    
    const correlationId = request.id || randomUUID();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    
    // Developer diagnostics for server logs only
    let devDetails: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.mapStatusToCode(status, exception);
      const res = exception.getResponse();
      
      // For 4xx errors, we can safely expose the message
      if (status < 500) {
        message = typeof res === 'string' ? res : (res as any).message || message;
        // In case of class-validator errors, message is an array. Join it or pick the first one.
        if (Array.isArray(message)) {
          devDetails = message;
          message = 'Validation failed'; 
        }
      } else {
        // For 500 HttpExceptions, mask the actual message to users, but log it
        devDetails = res;
      }
    } else if (exception instanceof Error) {
      // 500 Unhandled Error
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      devDetails = { message: exception.message, stack: exception.stack };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      devDetails = exception;
    }

    // Log the error
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] HTTP ${status} Error on ${request.method} ${request.url}`,
        devDetails?.stack || JSON.stringify(devDetails)
      );
    } else {
      this.logger.warn(
        `[${correlationId}] HTTP ${status} Warning on ${request.method} ${request.url}: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
      );
    }

    response.status(status).send({
      statusCode: status,
      code,
      message,
      correlationId,
    });
  }
}
