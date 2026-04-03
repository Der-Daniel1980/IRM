import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const DEV_CREDENTIALS = {
  email: 'admin',
  password: 'admin',
  name: 'Demo Admin',
  role: 'admin',
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  devLogin(email: string, password: string): { access_token: string; user: { email: string; name: string; role: string } } {
    if (process.env['APP_ENV'] !== 'development') {
      throw new ForbiddenException('Dev-Login ist nur im Entwicklungsmodus verfügbar');
    }

    if (email !== DEV_CREDENTIALS.email || password !== DEV_CREDENTIALS.password) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const payload = {
      sub: 'dev-admin',
      email: DEV_CREDENTIALS.email,
      name: DEV_CREDENTIALS.name,
      role: DEV_CREDENTIALS.role,
      preferred_username: 'demo_admin',
    };

    const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });

    return {
      access_token,
      user: {
        email: DEV_CREDENTIALS.email,
        name: DEV_CREDENTIALS.name,
        role: DEV_CREDENTIALS.role,
      },
    };
  }
}
