import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganisationService } from './organisation.service';
import { SetupOrganisationDto } from './dto/setup-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUTHENTIFIE,
  ROLES_GESTION_USERS,
} from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Organisation & Setup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Get()
  @Roles(...ROLES_AUTHENTIFIE)
  @ApiOperation({ summary: "Récupérer les infos de l'entreprise" })
  getOrganisation() {
    return this.organisationService.getOrganisation();
  }

  @Post('setup')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Assistant de configuration initiale (Wizard)' })
  @ApiResponse({
    status: 201,
    description: 'Organisation configurée avec succès',
  })
  setup(@Req() req, @Body() dto: SetupOrganisationDto) {
    return this.organisationService.setup(dto, req.user);
  }

  @Patch()
  @Roles(...ROLES_GESTION_USERS)
  @ApiOperation({ summary: 'Mise à jour des infos (Nom, Logo...)' })
  update(@Req() req, @Body() dto: UpdateOrganisationDto) {
    return this.organisationService.update(dto, req.user);
  }

  // ── Upload logo organisation ───────────────────────────────────────────────

  @Post('logo')
  @Roles(...ROLES_GESTION_USERS)
  @ApiOperation({
    summary: "Téléverser le logo de l'organisation",
    description: 'Image PNG/JPG/WEBP, max 2 Mo. Retourne logoUrl.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
    }),
  )
  async uploadLogo(@Req() req, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const TYPES_ACCEPTES = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
    ];
    if (!TYPES_ACCEPTES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé. Formats acceptés : PNG, JPG, WEBP, SVG.`,
      );
    }

    // Stockage : /uploads/organisation/logo-<timestamp>.<ext>
    const uploadsDir = path.join(process.cwd(), 'uploads', 'organisation');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.originalname) || `.${file.mimetype.split('/').pop()}`;
    const safeName = `logo-${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, file.buffer);

    const logoUrl = `/uploads/organisation/${safeName}`;

    // Persiste dans l'org + log
    await this.organisationService.update({ logoUrl } as any, req.user);

    return { logoUrl };
  }
}
