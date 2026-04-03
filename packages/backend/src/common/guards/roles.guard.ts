import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, IrmRole } from '../decorators/roles.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<IrmRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Im Entwicklungsmodus alle Rollen erlauben
    if (process.env.APP_ENV === 'development') return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    // Keycloak-Rollen aus realm_access oder direkt aus roles-Claim
    const userRoles: string[] =
      user?.realm_access?.roles ?? user?.roles ?? [];

    // irm-admin darf alles
    if (userRoles.includes('irm-admin')) return true;

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        `Fehlende Berechtigung. Benötigt: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
