import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';
import { RoleUtilisateur, TypeActionLog } from 'src/generated/prisma/enums';
import { isAuditTeamRole } from 'src/auth/constants/roles-matrix';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppGateway } from 'src/socket-io/gateways/app.gateway';
import { SOCKET_EVENTS } from 'src/socket-io/interfaces/connected-user.interface';

export interface UserContext {
  id: string;
  nom: string;
  role: RoleUtilisateur | string;
}

@Injectable()
export class CommentairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
    private readonly gateway: AppGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createurId: string, dto: CreateCommentaireDto, user?: UserContext) {
    const { typeEntite, entiteId, texte, estInterne = false } = dto;

    // Sécurité : seuls les membres de l'équipe audit peuvent créer un commentaire INTERNE.
    // Les BU créant un commentaire interne le verront forcer en non-interne.
    let estInterneSafe = estInterne;
    if (estInterne && user && !isAuditTeamRole(user.role as RoleUtilisateur)) {
      estInterneSafe = false;
    }

    const relationsEntite: Record<string, any> = {};
    if (typeEntite === 'POINT_AUDIT') {
      relationsEntite.pointAuditId = entiteId;
    } else if (typeEntite === 'POINT_FRAUDE') {
      relationsEntite.pointFraudeId = entiteId;
    }

    const commentaire = await this.prisma.commentaire.create({
      data: {
        typeEntite,
        entiteId,
        texte,
        estInterne: estInterneSafe,
        creePar: createurId,
        ...relationsEntite,
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role as string,
        action: TypeActionLog.CREATION,
        entiteType: 'COMMENTAIRE',
        entiteId: commentaire.id,
        entiteRef: `${typeEntite}/${entiteId}`,
        details: { estInterne: estInterneSafe },
      });
    }

    // 🔌 Temps réel — diffuse à l'équipe audit (et seulement à eux si interne)
    const payload = {
      id: commentaire.id,
      typeEntite,
      entiteId,
      texte: commentaire.texte,
      estInterne: estInterneSafe,
      creePar: createurId,
      dateCreation: commentaire.dateCreation,
    };
    if (estInterneSafe) {
      this.gateway.emitToAuditTeam(SOCKET_EVENTS.COMMENT_CREATED, payload);
    } else {
      this.gateway.broadcast(SOCKET_EVENTS.COMMENT_CREATED, payload);
    }

    // 📬 Notifier le créateur de l'entité commentée (point/action) si différent de l'auteur
    try {
      if (typeEntite === 'POINT_AUDIT') {
        const point = await this.prisma.pointAudit.findUnique({
          where: { id: entiteId },
          select: {
            reference: true,
            createur: { select: { id: true, email: true } },
          },
        });
        if (point?.createur && point.createur.id !== createurId) {
          await this.notificationsService.creer({
            destinataire: point.createur.email,
            utilisateurId: point.createur.id,
            sujet: `[NOUVEAU COMMENTAIRE] ${point.reference}`,
            message: `${user?.nom ?? 'Quelqu\'un'} a commenté sur votre constat ${point.reference}.`,
            type: 'NOUVEAU_COMMENTAIRE',
            entiteType: 'POINT_AUDIT',
            entiteId,
          });
        }
      }
    } catch (err) {
      console.error('[commentaires] Échec notif:', err);
    }

    return commentaire;
  }

  async findByEntite(typeEntite: string, entiteId: string, user?: UserContext) {
    const where: any = { typeEntite, entiteId };

    // Filtrage : si l'utilisateur n'est PAS dans l'équipe audit, on cache les commentaires internes
    if (user && !isAuditTeamRole(user.role as RoleUtilisateur)) {
      where.estInterne = false;
    }

    return this.prisma.commentaire.findMany({
      where,
      orderBy: { dateCreation: 'asc' },
    });
  }

  async remove(id: string, user?: UserContext) {
    const existing = await this.prisma.commentaire.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Commentaire introuvable.');

    // Vérification : seul l'auteur OU un ADMIN/DIRECTEUR_AUDIT peut supprimer
    if (user) {
      const isAuteur = existing.creePar === user.id;
      const isAdminPrivilegie =
        user.role === RoleUtilisateur.ADMIN ||
        user.role === RoleUtilisateur.DIRECTEUR_AUDIT;

      if (!isAuteur && !isAdminPrivilegie) {
        throw new ForbiddenException(
          "Seul l'auteur d'un commentaire peut le supprimer",
        );
      }
    }

    const result = await this.prisma.commentaire.delete({ where: { id } });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role as string,
        action: TypeActionLog.SUPPRESSION,
        entiteType: 'COMMENTAIRE',
        entiteId: id,
        entiteRef: `${existing.typeEntite}/${existing.entiteId}`,
      });
    }

    // 🔌 Temps réel
    this.gateway.broadcast(SOCKET_EVENTS.COMMENT_DELETED, {
      id,
      typeEntite: existing.typeEntite,
      entiteId: existing.entiteId,
    });

    return result;
  }
}
