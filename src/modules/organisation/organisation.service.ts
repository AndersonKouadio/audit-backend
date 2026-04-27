import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SetupOrganisationDto } from './dto/setup-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

@Injectable()
export class OrganisationService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Récupérer les infos
  async getOrganisation() {
    const org = await this.prisma.organisation.findFirst();
    if (!org)
      throw new NotFoundException('Organisation introuvable (Seed manquant ?)');
    return org;
  }

  // 2. LE WIZARD (Transactionnel)
  async setup(dto: SetupOrganisationDto) {
    const org = await this.prisma.organisation.findFirst();
    if (!org) throw new BadRequestException('Aucune organisation trouvée');

    // Transaction : Tout ou rien
    return this.prisma.$transaction(async (tx) => {
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
  }

  // 3. Update classique
  async update(dto: UpdateOrganisationDto) {
    const org = await this.prisma.organisation.findFirst();
    if (!org) throw new NotFoundException('Organisation introuvable');

    return this.prisma.organisation.update({
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
  }
}
