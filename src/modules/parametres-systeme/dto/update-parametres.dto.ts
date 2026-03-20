import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateParametresDto {
  // Notifications
  @IsOptional()
  @IsBoolean()
  emailNotificationsActives?: boolean;

  @IsOptional()
  @IsBoolean()
  resumeQuotidienActif?: boolean;

  // Seuils Ageing
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  seuilAgeingAttention?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  seuilAgeingCritique?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  seuilAgeingBloquant?: number;

  // Dunning
  @IsOptional()
  @IsBoolean()
  dunningActif?: boolean;

  @IsOptional()
  @IsIn(['HEBDOMADAIRE', 'MENSUEL'])
  dunningFrequence?: string;

  // Session
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionTimeoutMinutes?: number;
}
