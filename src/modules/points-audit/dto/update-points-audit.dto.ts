import { PartialType } from '@nestjs/swagger';
import { CreatePointAuditDto } from './create-points-audit.dto';

export class UpdatePointsAuditDto extends PartialType(CreatePointAuditDto) {}
