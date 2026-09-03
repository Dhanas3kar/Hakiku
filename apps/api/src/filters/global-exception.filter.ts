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
          message = message.join(', '); // Return all validation errors to the client
        }
      } else {
        // For 500 HttpExceptions, mask the actual message to users, but log it
        devDetails = res;
        console.error('Unhandled 500 HttpException:', res);
      }
    } else if (exception instanceof Error) {
      const pgError = exception as any;
      console.error('Unhandled Server Error:', pgError);
      
      if (pgError.code === '23505') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'A resource with this identifier already exists.';
        devDetails = { code: pgError.code, detail: pgError.detail };
      } else if (pgError.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        code = 'BAD_REQUEST';
        message = 'Invalid reference. The requested resource or related entity does not exist.';
        devDetails = { code: pgError.code, detail: pgError.detail };
      } else if (
        pgError.code === '53300' || // too_many_connections
        pgError.code === '57P01' // admin_shutdown
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = 'SERVICE_UNAVAILABLE';
        message = 'Service is temporarily unavailable';
        devDetails = { code: pgError.code, message: pgError.message, stack: pgError.stack };
      } else {
        // 500 Unhandled Error
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'INTERNAL_ERROR';
        devDetails = { message: exception.message, stack: exception.stack };
      }
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
