import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('keycloak-jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Im Entwicklungsmodus Auth überspringen
    if (process.env.APP_ENV === 'development') {
      this.logger.warn('JWT-Auth im DEV-Modus deaktiviert!');
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error, user: T): T {
    if (process.env.APP_ENV === 'development') return (user ?? {}) as T;
    if (err || !user) {
      throw err ?? new UnauthorizedException('Kein gültiges JWT-Token');
    }
    return user;
  }
}
