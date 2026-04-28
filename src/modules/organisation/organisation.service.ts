import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SetupOrganisationDto } from './dto/setup-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { JournalAuditService } from '../journal-audit/journal-audit.service';

export interface UserContext {
  id: string;
  nom: string;
  role: string;
}

@Injectable()
export class OrganisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
  ) {}

  // 1. Récupérer les infos
  async getOrganisation() {
    const org = await this.prisma.organisation.findFirst();
    if (!org)
      throw new NotFoundException('Organisation introuvable (Seed manquant ?)');
    return org;
  }

  // 2. LE WIZARD (Transactionnel)
  async setup(dto: SetupOrganisationDto, actor?: UserContext) {
    const org = await this.prisma.organisation.findFirst();
    if (!org) throw new BadRequestException('Aucune organisation trouvée');

    // Transaction : Tout ou rien
    const result = await this.prisma.$transaction(async (tx) => {
      // A. Mise à jour de l'organisation
      const updatedOrg = await tx.organisation.update({
        where: { id: org.id },
        data: {
          nom: dto.nom,
          matricule: dto.matricule,
          adresse: dto.adresse,
          siteWeb: dto.siteWeb,
          logoUrl: dto.logoUrl,
          estConfiguree: true,
        },
      });

      // B. Création des départements initiaux
      if (dto.departements && dto.departements.length > 0) {
        for (const dept of dto.departements) {
          await tx.departement.upsert({
            where: { code: dept.code },
            update: { nom: dept.nom },
            create: {
              code: dept.code,
              nom: dept.nom,
            },
          });
        }
      }

      return updatedOrg;
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'ORGANISATION',
        entiteId: result.id,
        entiteRef: result.nom,
        details: { action: 'setup_wizard', nbDepartements: dto.departements?.length ?? 0 },
      });
    }

    return result;
  }

  // 3. Update classique
  async update(dto: UpdateOrganisationDto, actor?: UserContext) {
    const org = await this.prisma.organisation.findFirst();
    if (!org) throw new NotFoundException('Organisation introuvable');

    const updated = await this.prisma.organisation.update({
      where: { id: org.id },
      data: {
        nom: dto.nom,
        matricule: dto.matricule,
        adresse: dto.adresse,
        siteWeb: dto.siteWeb,
        logoUrl: dto.logoUrl,
        estConfiguree: true,
      },
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'ORGANISATION',
        entiteId: updated.id,
        entiteRef: updated.nom,
        details: { champs: Object.keys(dto) },
      });
    }

    return updated;
  }
}
