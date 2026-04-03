import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';

interface DevLoginBody {
  email: string;
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dev-Login (nur Development)',
    description:
      'Gibt einen JWT zurück. Funktioniert ausschließlich wenn APP_ENV=development gesetzt ist.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'admin@irm.local' },
        password: { type: 'string', example: 'demo123' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login erfolgreich — JWT zurückgegeben',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Ungültige Anmeldedaten' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Nicht im Entwicklungsmodus' })
  devLogin(@Body() body: DevLoginBody) {
    return this.authService.devLogin(body.email, body.password);
  }
}
