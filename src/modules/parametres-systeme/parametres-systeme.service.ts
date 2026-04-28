import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateParametresDto } from './dto/update-parametres.dto';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { JournalAuditService } from '../journal-audit/journal-audit.service';

export interface UserContext {
  id: string;
  nom: string;
  role: string;
}

// Valeurs par défaut du singleton (si la ligne n'existe pas encore en BD)
const DEFAULTS = {
  id: 'singleton',
  emailNotificationsActives: true,
  resumeQuotidienActif: true,
  seuilAgeingAttention: 90,
  seuilAgeingCritique: 180,
  seuilAgeingBloquant: 365,
  dunningActif: true,
  dunningFrequence: 'HEBDOMADAIRE',
  sessionTimeoutMinutes: 30,
};

@Injectable()
export class ParametresSystemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
  ) {}

  private get db() {
    return this.prisma.parametresSysteme;
  }

  // ── Lire les paramètres (upsert du singleton si absent) ──────────────────

  async obtenir() {
    return this.db.upsert({
      where: { id: 'singleton' },
      create: DEFAULTS,
      update: {}, // Ne rien modifier si déjà présent
    });
  }

  // ── Mettre à jour les paramètres ─────────────────────────────────────────

  async modifier(dto: UpdateParametresDto, actor?: UserContext) {
    const result = await this.db.upsert({
      where: { id: 'singleton' },
      create: { ...DEFAULTS, ...dto },
      update: dto,
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'PARAMETRES_SYSTEME',
        entiteId: result.id,
        entiteRef: 'Configuration globale',
        details: { champs: Object.keys(dto) },
      });
    }

    return result;
  }
}
