import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit(): void {
    if (process.env['APP_ENV'] === 'development') {
      const userIsDefault = !process.env['DEV_LOGIN_USER'];
      const passIsDefault = !process.env['DEV_LOGIN_PASSWORD'];
      if (userIsDefault || passIsDefault) {
        this.logger.warn(
          'Dev-Login nutzt Standard-Credentials (admin/admin). ' +
            'DEV_LOGIN_USER und DEV_LOGIN_PASSWORD in der .env setzen!',
        );
      }
    }
  }

  devLogin(email: string, password: string): { access_token: string; user: { email: string; name: string; role: string } } {
    if (process.env['APP_ENV'] !== 'development') {
      throw new ForbiddenException('Dev-Login ist nur im Entwicklungsmodus verfügbar');
    }

    const DEV_USER = process.env['DEV_LOGIN_USER'] ?? 'admin';
    const DEV_PASS = process.env['DEV_LOGIN_PASSWORD'] ?? 'admin';

    if (email !== DEV_USER || password !== DEV_PASS) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const payload = {
      sub: 'dev-admin',
      email: DEV_USER,
      name: 'Demo Admin',
      role: 'admin',
      preferred_username: 'demo_admin',
    };

    const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });

    return {
      access_token,
      user: {
        email: DEV_USER,
        name: 'Demo Admin',
        role: 'admin',
      },
    };
  }
}
