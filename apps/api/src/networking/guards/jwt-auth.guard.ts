import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Extract token from cookie or Authorization header
    let token = (request as any).cookies?.['access_token'];
    if (!token) {
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET!,
        issuer: process.env.JWT_ISSUER || 'hakiku.com',
        audience: process.env.JWT_AUDIENCE || 'hakiku.com',
        ignoreExpiration: false,
      });
      (request as any).user = payload;
      return true;
    } catch (e) {
      console.error('JwtAuthGuard Error:', e);
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }
}
