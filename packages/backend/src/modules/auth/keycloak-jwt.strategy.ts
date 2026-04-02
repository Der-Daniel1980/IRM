import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(
  Strategy,
  'keycloak-jwt',
) {
  private readonly logger = new Logger(KeycloakJwtStrategy.name);
  private publicKey: string | null = null;

  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // secretOrKeyProvider wird aufgerufen, wenn kein secretOrKey gesetzt
      secretOrKeyProvider: async (
        _request: unknown,
        _rawJwtToken: unknown,
        done: (err: Error | null, key: string | null) => void,
      ) => {
        try {
          const key = await (
            new KeycloakJwtStrategy(configService) as unknown as {
              getPublicKey: () => Promise<string>;
            }
          ).getPublicKey();
          done(null, key);
        } catch (err) {
          done(err as Error, null);
        }
      },
    });
  }

  async getPublicKey(): Promise<string> {
    if (this.publicKey) return this.publicKey;

    const keycloakUrl = this.configService.get<string>('app.keycloak.url');
    const realm = this.configService.get<string>('app.keycloak.realm');
    const certsUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;

    try {
      const { data } = await axios.get<{ keys: { x5c?: string[] }[] }>(certsUrl);
      const key = data.keys[0];
      if (key.x5c?.[0]) {
        this.publicKey = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
      }
    } catch (err) {
      this.logger.warn(
        `Keycloak nicht erreichbar, verwende JWT_SECRET als Fallback: ${(err as Error).message}`,
      );
      this.publicKey =
        this.configService.get<string>('JWT_SECRET') ?? 'change_me_to_random_string';
    }

    return this.publicKey!;
  }

  validate(payload: Record<string, unknown>): JwtPayload {
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: (payload.name ?? payload.preferred_username) as string,
      given_name: payload.given_name as string | undefined,
      family_name: payload.family_name as string | undefined,
      roles: (payload.roles as string[]) ?? [],
      realm_access: payload.realm_access as
        | { roles: string[] }
        | undefined,
    };
  }
}
