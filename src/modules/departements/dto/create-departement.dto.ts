import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDepartementDto {
  @ApiProperty({ example: 'FIN-COMPTA', description: 'Code unique' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Service Comptabilité' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({ example: 'Gestion des factures fournisseurs' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'uuid-du-parent',
    description: 'ID du département parent (ex: Direction Finance)',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({
    required: false,
    description: 'ID utilisateur du Risk Champion du département',
  })
  @IsOptional()
  @IsString()
  riskChampionId?: string;
}
