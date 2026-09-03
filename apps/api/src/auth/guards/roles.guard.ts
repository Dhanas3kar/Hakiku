import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true; // No roles required
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException(`RolesGuard Denied: No user found in request`);
    }
    
    if (!user.role) {
      throw new ForbiddenException(`RolesGuard Denied: User has no role`);
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`RolesGuard Denied: User role ${user.role} not in ${requiredRoles.join(',')}`);
    }

    return true;
  }
}
