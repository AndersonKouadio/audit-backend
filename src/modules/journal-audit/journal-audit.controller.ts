import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { ROLES_LECTURE_JOURNAL } from 'src/auth/constants/roles-matrix';
import { JournalQueryDto } from './dto/journal-query.dto';
import { JournalAuditService } from './journal-audit.service';

@ApiTags("Journal d'Audit (Logs)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('journal-audit')
export class JournalAuditController {
  constructor(private readonly journalAuditService: JournalAuditService) {}

  @Get()
  // Étendu : ADMIN, DIRECTEUR, CHEF_DEPT_AUDIT, CHEF_MISSION, LECTURE_SEULE
  @Roles(...ROLES_LECTURE_JOURNAL)
  @ApiOperation({ summary: "Consulter le journal d'audit avec filtres" })
  findAll(@Query() query: JournalQueryDto) {
    return this.journalAuditService.findAll(query);
  }
}
