import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprouverRafDto } from './dto/approuver-raf.dto';
import { CreateFormulaireRafDto } from './dto/create-formulaire-raf.dto';

// Statut calculé du formulaire RAF (déduit des champs d'approbation)
export type StatutRaf =
  | 'EN_ATTENTE_HOD'
  | 'APPROUVE_HOD'
  | 'APPROUVE_GM'
  | 'APPROUVE_CEO'
  | 'VALIDE';

function computeStatutRaf(raf: any): StatutRaf {
  if (raf.validePar_ComiteAudit) return 'VALIDE';
  if (raf.approuvePar_CEO) return 'APPROUVE_CEO';
  if (raf.approuvePar_GM) return 'APPROUVE_GM';
  if (raf.approuvePar_HoD) return 'APPROUVE_HOD';
  return 'EN_ATTENTE_HOD';
}

@Injectable()
export class FormulaireRafService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Helper : notifier les utilisateurs d'un rôle donné ──────────────────

  private async notifierParRole(
    role: string,
    sujet: string,
    message: string,
    entiteId?: string,
  ) {
    const users = await this.prisma.utilisateur.findMany({
      where: { role: role as any },
      select: { id: true, email: true },
    });
    for (const user of users) {
      await this.notificationsService.creer({
        destinataire: user.email,
        sujet,
        message,
        type: 'CHANGEMENT_STATUT',
        utilisateurId: user.id,
        entiteType: 'FORMULAIRE_RAF',
        entiteId,
      });
    }
  }

  // ─── Créer un formulaire RAF ───────────────────────────────────────────────

  async creer(dto: CreateFormulaireRafDto) {
    // Générer un numéro unique RAF-YYYY-XXX
    const annee = new Date().getFullYear();
    const prefix = `RAF-${annee}-`;
    const count = await this.prisma.formulaireAcceptationRisque.count({
      where: { numero: { startsWith: prefix } },
    });
    const numero = `${prefix}${String(count + 1).padStart(3, '0')}`;

    const data: any = {
      numero,
      justification: dto.justification,
      controleCompensatoire: dto.controleCompensatoire ?? null,
    };

    if (dto.pointAuditIds && dto.pointAuditIds.length > 0) {
      data.pointsAudit = {
        connect: dto.pointAuditIds.map((id) => ({ id })),
      };
    }

    const raf = await this.prisma.formulaireAcceptationRisque.create({
      data,
      include: {
        pointsAudit: {
          select: { id: true, reference: true, titre: true, statut: true },
        },
      },
    });

    // ── Notifier les HoD qu'un nouveau RAF nécessite leur approbation ──
    await this.notifierParRole(
      RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
      `Nouveau formulaire RAF — ${numero}`,
      `Un formulaire d'acceptation du risque (${numero}) a été soumis et nécessite votre approbation en tant que Head of Department.`,
      raf.id,
    );

    return { ...raf, statutRaf: computeStatutRaf(raf) };
  }

  // ─── Lister les formulaires RAF ───────────────────────────────────────────

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { numero: { contains: params.search, mode: 'insensitive' } },
        { justification: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.formulaireAcceptationRisque.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pointsAudit: {
            select: { id: true, reference: true, titre: true, statut: true },
          },
        },
      }),
      this.prisma.formulaireAcceptationRisque.count({ where }),
    ]);

    return {
      data: data.map((r: any) => ({ ...r, statutRaf: computeStatutRaf(r) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Obtenir un formulaire RAF par ID ──────────────────────────────────────

  async findOne(id: string) {
    const raf = await this.prisma.formulaireAcceptationRisque.findUnique({
      where: { id },
      include: {
        pointsAudit: {
          select: {
            id: true,
            reference: true,
            titre: true,
            statut: true,
            criticite: true,
            departement: { select: { nom: true, code: true } },
          },
        },
      },
    });

    if (!raf) throw new NotFoundException('Formulaire RAF introuvable.');
    return { ...raf, statutRaf: computeStatutRaf(raf) };
  }

  // ─── Approuver un formulaire RAF ──────────────────────────────────────────

  async approuver(id: string, dto: ApprouverRafDto, user?: { role: string; nom: string }) {
    const raf = await this.prisma.formulaireAcceptationRisque.findUnique({
      where: { id },
    });
    if (!raf) throw new NotFoundException('Formulaire RAF introuvable.');

    // Vérification du rôle par niveau d'approbation
    if (user) {
      const rolesHod = [RoleUtilisateur.MANAGER_METIER, RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT];
      const rolesGmCeoComite = [RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT, RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT];
      const roleMap: Record<string, string[]> = {
        HOD: rolesHod,
        GM: rolesGmCeoComite,
        CEO: rolesGmCeoComite,
        COMITE: rolesGmCeoComite,
      };
      const allowed = roleMap[dto.niveau] ?? [];
      if (!allowed.includes(user.role as RoleUtilisateur)) {
        throw new ForbiddenException(
          `Le niveau d'approbation "${dto.niveau}" requiert l'un des rôles suivants : ${allowed.join(', ')}.`,
        );
      }
    }

    const updateData: any = {};

    switch (dto.niveau) {
      case 'HOD':
        if (raf.approuvePar_HoD) {
          throw new BadRequestException('Ce formulaire a déjà été approuvé par le HoD.');
        }
        updateData.approuvePar_HoD = dto.nom;
        break;

      case 'GM':
        if (!raf.approuvePar_HoD) {
          throw new BadRequestException(
            "L'approbation du HoD (Head of Department) est requise avant l'approbation GM.",
          );
        }
        if (raf.approuvePar_GM) {
          throw new BadRequestException('Ce formulaire a déjà été approuvé par le GM.');
        }
        updateData.approuvePar_GM = dto.nom;
        break;

      case 'CEO':
        if (!raf.approuvePar_GM) {
          throw new BadRequestException(
            "L'approbation du GM (General Manager) est requise avant l'approbation CEO.",
          );
        }
        if (raf.approuvePar_CEO) {
          throw new BadRequestException('Ce formulaire a déjà été approuvé par le CEO.');
        }
        updateData.approuvePar_CEO = dto.nom;
        break;

      case 'COMITE':
        if (!raf.approuvePar_CEO) {
          throw new BadRequestException(
            "L'approbation du CEO est requise avant la validation par le Comité d'Audit.",
          );
        }
        if (raf.validePar_ComiteAudit) {
          throw new BadRequestException(
            "Ce formulaire a déjà été validé par le Comité d'Audit.",
          );
        }
        updateData.validePar_ComiteAudit = dto.nom;
        updateData.dateValidationFinal = new Date();
        break;
    }

    const updated = await this.prisma.formulaireAcceptationRisque.update({
      where: { id },
      data: updateData,
      include: {
        pointsAudit: {
          select: { id: true, reference: true, titre: true, statut: true },
        },
      },
    });

    // ── Notifications post-approbation selon le niveau ──────────────────────
    switch (dto.niveau) {
      case 'HOD':
        // Notifier les GM (Directeurs Audit) pour la prochaine étape
        await this.notifierParRole(
          RoleUtilisateur.DIRECTEUR_AUDIT,
          `RAF ${raf.numero} — Approuvé HoD, en attente GM`,
          `Le formulaire RAF ${raf.numero} a été approuvé par le Head of Department (${dto.nom}). Il nécessite maintenant votre approbation en tant que General Manager.`,
          id,
        );
        break;

      case 'GM':
        // Notifier les Admins pour l'étape CEO
        await this.notifierParRole(
          RoleUtilisateur.ADMIN,
          `RAF ${raf.numero} — Approuvé GM, en attente CEO`,
          `Le formulaire RAF ${raf.numero} a été approuvé par le General Manager (${dto.nom}). Il nécessite maintenant l'approbation du CEO.`,
          id,
        );
        break;

      case 'CEO':
        // Notifier les Admins pour la validation Comité
        await this.notifierParRole(
          RoleUtilisateur.ADMIN,
          `RAF ${raf.numero} — Approuvé CEO, en attente Comité`,
          `Le formulaire RAF ${raf.numero} a été approuvé par le CEO (${dto.nom}). Il nécessite maintenant la validation du Comité d'Audit.`,
          id,
        );
        break;

      case 'COMITE':
        // Notifier les créateurs des points d'audit liés
        for (const point of updated.pointsAudit ?? []) {
          const pointFull = await this.prisma.pointAudit.findUnique({
            where: { id: point.id },
            include: { createur: { select: { id: true, email: true } } },
          });
          if (pointFull?.createur) {
            await this.notificationsService.creer({
              destinataire: (pointFull.createur as any).email,
              sujet: `RAF ${updated.numero} — Validé par le Comité d'Audit`,
              message: `Le formulaire d'acceptation du risque ${updated.numero} lié au constat "${point.titre}" (${point.reference}) a été entièrement validé par le Comité d'Audit (${dto.nom}).`,
              type: 'CHANGEMENT_STATUT',
              utilisateurId: (pointFull.createur as any).id,
              entiteType: 'FORMULAIRE_RAF',
              entiteId: id,
            });
          }
        }
        break;
    }

    return { ...updated, statutRaf: computeStatutRaf(updated) };
  }

  // ─── Lier un point d'audit existant à un RAF ──────────────────────────────

  async lierPointAudit(id: string, pointAuditId: string) {
    const raf = await this.prisma.formulaireAcceptationRisque.findUnique({
      where: { id },
    });
    if (!raf) throw new NotFoundException('Formulaire RAF introuvable.');

    const point = await this.prisma.pointAudit.findUnique({
      where: { id: pointAuditId },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");

    const updated = await this.prisma.formulaireAcceptationRisque.update({
      where: { id },
      data: {
        pointsAudit: { connect: { id: pointAuditId } },
      },
      include: {
        pointsAudit: {
          select: { id: true, reference: true, titre: true, statut: true },
        },
      },
    });

    return { ...updated, statutRaf: computeStatutRaf(updated) };
  }

  // ─── Annuler / supprimer un RAF ────────────────────────────────────────────

  async remove(id: string, _user?: { id: string; role: string; nom: string }) {
    const raf = await this.prisma.formulaireAcceptationRisque.findUnique({
      where: { id },
    });
    if (!raf) throw new NotFoundException('Formulaire RAF introuvable.');

    // Refus si déjà validé par le comité d'audit
    if (raf.dateValidationFinal) {
      throw new ForbiddenException(
        "Ce RAF a déjà été validé par le Comité d'Audit et ne peut plus être supprimé.",
      );
    }

    return this.prisma.formulaireAcceptationRisque.delete({ where: { id } });
  }
}
