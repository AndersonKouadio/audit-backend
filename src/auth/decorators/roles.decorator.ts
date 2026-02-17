import { SetMetadata } from '@nestjs/common';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

export const Roles = (...roles: RoleUtilisateur[]) =>
  SetMetadata('roles', roles);
