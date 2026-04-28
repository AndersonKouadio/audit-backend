import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/mailer/email.service';
import { ParametresSystemeService } from 'src/modules/parametres-systeme/parametres-systeme.service';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { AppGateway } from 'src/socket-io/gateways/app.gateway';
import { SOCKET_EVENTS } from 'src/socket-io/interfaces/connected-user.interface';

export interface CreateNotificationDto {
  destinataire: string;
  sujet: string;
  message: string;
  type: string;
  utilisateurId?: string;
  entiteType?: string;
  entiteId?: string;
  dateProgrammee?: Date;
  envoiImmediat?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly parametresService: ParametresSystemeService,
    private readonly gateway: AppGateway,
  ) {}

  // ─── Créer une notification (in-app + email si activé) ───────────────────

  async creer(dto: CreateNotificationDto) {
    const notif = await this.prisma.notification.create({
      data: {
        destinataire: dto.destinataire,
        sujet: dto.sujet,
        message: dto.message,
        type: dto.type,
        statut: 'EN_ATTENTE',
        utilisateurId: dto.utilisateurId ?? null,
        entiteType: dto.entiteType ?? null,
        entiteId: dto.entiteId ?? null,
        dateProgrammee: dto.dateProgrammee ?? null,
      },
    });

    if (dto.envoiImmediat) {
      await this.envoyerNotification(notif.id);
    }

    // 🔌 Push temps réel à l'utilisateur destinataire (toutes ses sessions)
    if (dto.utilisateurId) {
      this.gateway.emitToUser(dto.utilisateurId, SOCKET_EVENTS.NOTIFICATION_NEW, {
        id: notif.id,
        sujet: notif.sujet,
        message: notif.message,
        type: notif.type,
        entiteType: notif.entiteType,
        entiteId: notif.entiteId,
        dateCreation: notif.createdAt,
      });
    }

    return notif;
  }

  // ─── Envoyer une notification par son ID ─────────────────────────────────

  async envoyerNotification(notifId: string): Promise<boolean> {
    const notif = await this.prisma.notification.findUnique({ where: { id: notifId } });
    if (!notif || notif.statut === 'ENVOYE') return false;

    // Vérifier si les notifications email sont activées dans les paramètres système
    const params = await this.parametresService.obtenir();
    if (!params.emailNotificationsActives) {
      // Marquer comme "envoyée" dans la file pour ne pas bloquer la queue,
      // mais on n'envoie pas réellement l'email
      await this.prisma.notification.update({
        where: { id: notifId },
        data: { statut: 'ENVOYE', dateEnvoi: new Date() },
      });
      return true;
    }

    const success = await this.emailService.sendEmail({
      to: notif.destinataire,
      subject: notif.sujet,
      html: `<div style="font-family:Arial,sans-serif;padding:20px;">${notif.message}</div>`,
      text: notif.message,
    });

    await this.prisma.notification.update({
      where: { id: notifId },
      data: {
        statut: success ? 'ENVOYE' : 'ERREUR',
        dateEnvoi: success ? new Date() : undefined,
      },
    });

    return success;
  }

  // ─── Traiter toutes les notifications EN_ATTENTE ──────────────────────────

  async traiterFileAttente(): Promise<{ envoyes: number; erreurs: number }> {
    const notifs = await this.prisma.notification.findMany({
      where: { statut: 'EN_ATTENTE' },
      take: 50,
    });

    let envoyes = 0;
    let erreurs = 0;

    for (const notif of notifs) {
      const success = await this.envoyerNotification(notif.id);
      if (success) envoyes++;
      else erreurs++;
    }

    return { envoyes, erreurs };
  }

  // ─── Lister les notifications d'un utilisateur ────────────────────────────

  async findByUser(
    utilisateurId: string,
    options: { page?: number; limit?: number; luSeulement?: boolean } = {},
  ): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 20, luSeulement } = options;
    const skip = (page - 1) * limit;

    const where: any = { utilisateurId };
    if (luSeulement === false) where.lu = false;
    else if (luSeulement === true) where.lu = true;

    const [total, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Compter les notifications non lues ──────────────────────────────────

  async compterNonLues(utilisateurId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { utilisateurId, lu: false },
    });
  }

  // ─── Marquer une notification comme lue ──────────────────────────────────

  async marquerLue(id: string, utilisateurId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, utilisateurId },
    });
    if (!notif) throw new NotFoundException('Notification introuvable.');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { lu: true, dateLecture: new Date() },
    });

    // 🔌 sync temps réel sur les autres onglets/devices de l'utilisateur
    this.gateway.emitToUser(utilisateurId, SOCKET_EVENTS.NOTIFICATION_READ, {
      id,
      lu: true,
    });

    return updated;
  }

  // ─── Marquer toutes les notifications comme lues ─────────────────────────

  async marquerToutesLues(utilisateurId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { utilisateurId, lu: false },
      data: { lu: true, dateLecture: new Date() },
    });
    return { marques: result.count };
  }
}
