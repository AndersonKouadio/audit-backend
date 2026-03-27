import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Utilisateur } from 'src/generated/prisma/client';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() : accessible à tout utilisateur authentifié, sans restriction de rôle
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<RoleUtilisateur[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // Aucun @Roles() et pas @Public() → accès refusé par défaut (fail-secure)
    if (!requiredRoles) return false;

    const request: Request = context.switchToHttp().getRequest();
    const user = request.user as Utilisateur;
    return requiredRoles.some((role) => user.role === role);
  }
}
