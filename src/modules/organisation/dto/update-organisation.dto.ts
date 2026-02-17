import { OmitType, PartialType } from '@nestjs/swagger';
import { SetupOrganisationDto } from './setup-organisation.dto';

export class UpdateOrganisationDto extends PartialType(
  OmitType(SetupOrganisationDto, ['departements'] as const),
) {}
