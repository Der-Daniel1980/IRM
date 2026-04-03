export type IrmRole =
  | 'irm-admin'
  | 'irm-disponent'
  | 'irm-objektverwalter'
  | 'irm-mitarbeiter'
  | 'irm-readonly';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  roles: string[];
  realm_access?: { roles: string[] };
}
