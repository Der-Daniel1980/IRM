import { SetMetadata } from '@nestjs/common';

export type IrmRole =
  | 'irm-admin'
  | 'irm-disponent'
  | 'irm-objektverwalter'
  | 'irm-mitarbeiter'
  | 'irm-readonly';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: IrmRole[]) => SetMetadata(ROLES_KEY, roles);
