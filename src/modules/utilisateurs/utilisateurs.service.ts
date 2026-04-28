import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import {
  Prisma,
  RoleUtilisateur,
  StatutUtilisateur,
  Utilisateur,
} from 'src/generated/prisma/client';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface UserContext {
  id: string;
  nom: string;
  role: RoleUtilisateur | string;
}

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Utilitaire privé pour standardiser la sélection du département
  private readonly defaultInclude = {
    departement: { select: { code: true, nom: true } },
  };

  // --- CRÉATION ---
  async create(dto: CreateUtilisateurDto, actor?: UserContext) {
    // 1. Vérifier si l'email existe déjà
    const existingUser = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) throw new ConflictException('Cet email est déjà utilisé');

    // 2. Vérifier le département si fourni
    if (dto.departementId) {
      const dept = await this.prisma.departement.findUnique({
        where: { id: dto.departementId },
      });
      if (!dept) throw new NotFoundException('Département introuvable');
    }

    // 3. Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.motDePasse, salt);

    // 4. Créer
    const user = await this.prisma.utilisateur.create({
      data: {
        ...dto,
        motDePasse: hashedPassword,
      },
      include: this.defaultInclude,
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role as string,
        action: TypeActionLog.CREATION,
        entiteType: 'UTILISATEUR',
        entiteId: user.id,
        entiteRef: `${user.prenom} ${user.nom} (${user.email})`,
        details: { role: user.role, departementId: user.departementId },
      });
    }

    // 📬 Notification de bienvenue (in-app + email)
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://audit-web.lunion-lab.com';
      await this.notificationsService.creer({
        destinataire: user.email,
        utilisateurId: user.id,
        sujet: '[BIENVENUE] Votre compte Audit Apps',
        message: `Bienvenue ${user.prenom} ${user.nom}. Votre compte a été créé avec le rôle ${user.role}. Connectez-vous à ${frontendUrl} avec l'email ${user.email} et le mot de passe communiqué par votre administrateur.`,
        type: 'BIENVENUE',
        entiteType: 'UTILISATEUR',
        entiteId: user.id,
      });
    } catch (err) {
      console.error('[utilisateurs] Échec notif bienvenue:', err);
    }

    // On retire le mot de passe proprement
    const { motDePasse, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // --- LISTING ---
  async findAll(
    query: UserQueryDto,
  ): Promise<PaginationResponseDto<Omit<Utilisateur, 'motDePasse'>>> {
    const { page = 1, limit = 10, search, departementId, role, statut } = query;
    const skip = (page - 1) * limit;

    // Fini le "any" ! On utilise le type strict de Prisma
    const where: Prisma.UtilisateurWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { nom: { contains: search, mode: 'insensitive' } },
                { prenom: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        departementId ? { departementId } : {},
        role ? { role: role as RoleUtilisateur } : {},
        statut ? { statut: statut as StatutUtilisateur } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.utilisateur.count({ where }),
      this.prisma.utilisateur.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateCreation: 'desc' },
        include: this.defaultInclude,
      }),
    ]);

    // Nettoyer les données par déstructuration (conserve la relation departement)
    const cleanData = data.map(({ motDePasse, ...rest }) => rest);

    return {
      data: cleanData as any, // Caster la réponse si besoin pour matcher PaginationResponseDto
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- DÉTAIL ---
  async findOne(id: string) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id },
      include: this.defaultInclude,
    });

    if (!user) throw new NotFoundException(`Utilisateur #${id} introuvable`);

    const { motDePasse, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // --- MISE À JOUR (ADMIN) ---
  async update(id: string, dto: UpdateUtilisateurDto, actor?: UserContext) {
    if (dto.motDePasse && dto.motDePasse.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      dto.motDePasse = await bcrypt.hash(dto.motDePasse, salt);
    } else {
      delete dto.motDePasse;
    }

    try {
      const user = await this.prisma.utilisateur.update({
        where: { id },
        data: dto,
        include: this.defaultInclude,
      });

      if (actor) {
        await this.journalService.logAction({
          utilisateurId: actor.id,
          utilisateurNom: actor.nom,
          utilisateurRole: actor.role as string,
          action: TypeActionLog.MODIFICATION,
          entiteType: 'UTILISATEUR',
          entiteId: id,
          entiteRef: `${user.prenom} ${user.nom} (${user.email})`,
          details: { champs: Object.keys(dto) },
        });
      }

      // 📬 Notif au user concerné si rôle/statut/dept changent
      const sensitiveChanges = ['role', 'statut', 'departementId'].filter((k) => k in dto);
      if (sensitiveChanges.length > 0) {
        try {
          await this.notificationsService.creer({
            destinataire: user.email,
            utilisateurId: user.id,
            sujet: '[VOTRE COMPTE] Modification de votre profil',
            message: `Votre profil a été modifié par un administrateur. Champs concernés : ${sensitiveChanges.join(', ')}.`,
            type: 'PROFIL_MODIFIE',
            entiteType: 'UTILISATEUR',
            entiteId: user.id,
          });
        } catch (err) {
          console.error('[utilisateurs] Échec notif modif:', err);
        }
      }

      const { motDePasse, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email déjà pris');
      }
      throw error;
    }
  }

  // --- MISE À JOUR (PROFIL PERSONNEL) ---
  async updateMe(id: string, dto: UpdateMeDto) {
    if (dto.motDePasse && dto.motDePasse.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      dto.motDePasse = await bcrypt.hash(dto.motDePasse, salt);
    } else {
      delete dto.motDePasse;
    }

    try {
      const user = await this.prisma.utilisateur.update({
        where: { id },
        data: dto,
        include: this.defaultInclude,
      });

      const { motDePasse, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email déjà pris');
      }
      throw error;
    }
  }

  // --- SUPPRESSION (avec audit trail) ---
  async remove(id: string, actor?: UserContext) {
    const target = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, email: true, nom: true, prenom: true, role: true },
    });
    if (!target) throw new NotFoundException(`Utilisateur #${id} introuvable`);

    const user = await this.prisma.utilisateur.delete({
      where: { id },
      include: this.defaultInclude,
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role as string,
        action: TypeActionLog.SUPPRESSION,
        entiteType: 'UTILISATEUR',
        entiteId: id,
        entiteRef: `${target.prenom} ${target.nom} (${target.email})`,
        details: { roleSupprime: target.role },
      });
    }

    const { motDePasse, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
