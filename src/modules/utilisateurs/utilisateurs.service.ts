import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import {
  RoleUtilisateur,
  StatutUtilisateur,
  Utilisateur,
} from 'src/generated/prisma/client';

@Injectable()
export class UtilisateursService {
  constructor(private readonly prisma: PrismaService) {}

  // --- CRÉATION ---
  async create(dto: CreateUtilisateurDto) {
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
    });

    return {
      id: user.id,
      matricule: user.matricule,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      role: user.role,
      statut: user.statut,
      departementId: user.departementId,
      dateCreation: user.dateCreation,
      dateMiseAJour: user.dateMiseAJour,
      derniereConnexion: user.derniereConnexion,
    };
  }

  // --- LISTING ---
  async findAll(
    query: UserQueryDto,
  ): Promise<PaginationResponseDto<Omit<Utilisateur, 'motDePasse'>>> {
    const { page = 1, limit = 10, search, departementId, role, statut } = query;
    const skip = (page - 1) * limit;

    // Construction dynamique du filtre Prisma
    const where: any = {
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
        include: { departement: { select: { nom: true } } },
      }),
    ]);

    // Nettoyer les données pour ne pas inclure le mot de passe
    const cleanData = data.map((user) => {
      return {
        id: user.id,
        matricule: user.matricule,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
        statut: user.statut,
        departementId: user.departementId,
        dateCreation: user.dateCreation,
        dateMiseAJour: user.dateMiseAJour,
        derniereConnexion: user.derniereConnexion,
      };
    });

    return {
      data: cleanData,
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
      include: { departement: true },
    });

    if (!user) throw new NotFoundException(`Utilisateur #${id} introuvable`);

    return {
      id: user.id,
      matricule: user.matricule,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      role: user.role,
      statut: user.statut,
      departementId: user.departementId,
      dateCreation: user.dateCreation,
      dateMiseAJour: user.dateMiseAJour,
      derniereConnexion: user.derniereConnexion,
    };
  }

  // --- MISE À JOUR ---
  async update(id: string, dto: UpdateUtilisateurDto) {
    // Si l'utilisateur veut changer le mot de passe, il faut le hasher à nouveau
    if (dto.motDePasse) {
      const salt = await bcrypt.genSalt(10);
      dto.motDePasse = await bcrypt.hash(dto.motDePasse, salt);
    }

    try {
      const user = await this.prisma.utilisateur.update({
        where: { id },
        data: dto,
      });

      return {
        id: user.id,
        matricule: user.matricule,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
        statut: user.statut,
        departementId: user.departementId,
        dateCreation: user.dateCreation,
        dateMiseAJour: user.dateMiseAJour,
        derniereConnexion: user.derniereConnexion,
      };
    } catch (error) {
      if (error.code === 'P2002')
        throw new ConflictException('Email déjà pris');
      throw error;
    }
  }
  async updateMe(id: string, dto: UpdateMeDto) {
    // Si l'utilisateur veut changer le mot de passe, il faut le hasher à nouveau
    if (dto.motDePasse) {
      const salt = await bcrypt.genSalt(10);
      dto.motDePasse = await bcrypt.hash(dto.motDePasse, salt);
    }

    try {
      const user = await this.prisma.utilisateur.update({
        where: { id },
        data: dto,
      });

      return {
        id: user.id,
        matricule: user.matricule,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
        statut: user.statut,
        departementId: user.departementId,
        dateCreation: user.dateCreation,
        dateMiseAJour: user.dateMiseAJour,
        derniereConnexion: user.derniereConnexion,
      };
    } catch (error) {
      if (error.code === 'P2002')
        throw new ConflictException('Email déjà pris');
      throw error;
    }
  }

  // --- SUPPRESSION (Soft ou Hard) ---
  async remove(id: string) {
    // Idéalement, on préfère souvent désactiver plutôt que supprimer pour garder l'historique des audits
    // Mais voici la suppression physique demandée
    return this.prisma.utilisateur.delete({ where: { id } });
  }
}
