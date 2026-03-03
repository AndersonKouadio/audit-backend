import { Injectable } from '@nestjs/common';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JournalQueryDto } from './dto/journal-query.dto';

export interface LogActionPayload {
  utilisateurId?: string;
  utilisateurNom?: string;
  utilisateurRole?: string;
  action: TypeActionLog;
  entiteType: string;
  entiteId?: string;
  entiteRef?: string;
  details?: Record<string, any>;
  motif?: string;
  adresseIP?: string;
  userAgent?: string;
}

@Injectable()
export class JournalAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(payload: LogActionPayload) {
    return this.prisma.journalAudit.create({
      data: {
        utilisateurId: payload.utilisateurId,
        utilisateurNom: payload.utilisateurNom,
        utilisateurRole: payload.utilisateurRole,
        action: payload.action,
        entiteType: payload.entiteType,
        entiteId: payload.entiteId,
        entiteRef: payload.entiteRef,
        details: payload.details as any,
        motif: payload.motif,
        adresseIP: payload.adresseIP,
        userAgent: payload.userAgent,
      },
    });
  }

  async findAll(query: JournalQueryDto): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 20, entiteType, entiteId, utilisateurId, action } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        entiteType ? { entiteType } : {},
        entiteId ? { entiteId } : {},
        utilisateurId ? { utilisateurId } : {},
        action ? { action } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.journalAudit.count({ where }),
      this.prisma.journalAudit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateAction: 'desc' },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
