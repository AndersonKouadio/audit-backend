import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Utilisateur } from 'src/generated/prisma/client';
import { RoleUtilisateur, TypeActionLog } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const allowed = requiredRoles.some((role) => user.role === role);

    // 📜 Logger les tentatives d'accès refusées pour le journal d'audit
    if (!allowed) {
      // Best-effort — ne bloque pas la réponse 403
      this.prisma.journalAudit
        .create({
          data: {
            utilisateurId: user.id,
            utilisateurNom: `${user.prenom ?? ''} ${user.nom ?? ''}`.trim(),
            utilisateurRole: user.role,
            utilisateurEmail: user.email,
            action: TypeActionLog.ACCES_REFUSE,
            entiteType: 'ENDPOINT',
            entiteRef: `${request.method} ${request.url}`,
            details: {
              requiredRoles,
              userRole: user.role,
            },
            adresseIP: request.ip ?? null,
            userAgent: request.get('user-agent') ?? null,
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Impossible de logger l'accès refusé : ${(err as Error).message}`,
          );
        });
    }

    return allowed;
  }
}
