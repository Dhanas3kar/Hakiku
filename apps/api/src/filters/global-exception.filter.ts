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

    const rawError: any = (exception as any)?.cause || (exception as any)?.getResponse?.() || exception;
    const errCode = rawError?.code || (exception as any)?.code;
    const errMessage = rawError?.message || (exception as any)?.message || String(exception);

    const isInfraError =
      errCode === '53300' || // too_many_connections
      errCode === '57P01' || // admin_shutdown
      errMessage.includes('too many connections') ||
      errMessage.includes('too_many_connections') ||
      errMessage.includes('Redis connection lost') ||
      errMessage.includes('Connection terminated') ||
      (exception as any)?.name === 'RedisError';

    if (isInfraError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'SERVICE_UNAVAILABLE';
      message = 'Service is temporarily unavailable';
      devDetails = { code: errCode, message: errMessage };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.mapStatusToCode(status, exception);
      const res = exception.getResponse();
      
      // For 4xx errors, we can safely expose the message
      if (status < 500) {
        message = typeof res === 'string' ? res : (res as any).message || message;
      } else {
        // For 500 HttpExceptions, mask the actual message to users, but log it
        devDetails = res;
        console.error('Unhandled 500 HttpException:', res);
      }
    } else if (exception instanceof Error) {
      console.error('Unhandled Server Error:', rawError);
      
      if (errCode === '23505') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'A resource with this identifier already exists.';
        devDetails = { code: errCode, detail: rawError.detail };
      } else if (errCode === '23503') {
        status = HttpStatus.BAD_REQUEST;
        code = 'BAD_REQUEST';
        message = 'Invalid reference. The requested resource or related entity does not exist.';
        devDetails = { code: errCode, detail: rawError.detail };
      } else {
        // 500 Unhandled Error
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'INTERNAL_ERROR';
        devDetails = { message: (exception as Error).message, stack: (exception as Error).stack };
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
