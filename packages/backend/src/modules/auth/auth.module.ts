import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { KeycloakJwtStrategy } from './keycloak-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'keycloak-jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change_me_to_random_string',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [KeycloakJwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
