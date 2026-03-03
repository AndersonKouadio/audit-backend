import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { JournalQueryDto } from './dto/journal-query.dto';
import { JournalAuditService } from './journal-audit.service';

@ApiTags("Journal d'Audit (Logs)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('journal-audit')
export class JournalAuditController {
  constructor(private readonly journalAuditService: JournalAuditService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: "Consulter le journal d'audit avec filtres" })
  findAll(@Query() query: JournalQueryDto) {
    return this.journalAuditService.findAll(query);
  }
}
