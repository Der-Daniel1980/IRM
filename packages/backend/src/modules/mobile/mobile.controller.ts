import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MobileService } from './mobile.service';
import { QueryMyOrdersDto } from './dto/query-my-orders.dto';
import { StartWorkDto } from './dto/start-work.dto';
import { StopWorkDto } from './dto/stop-work.dto';
import { SubmitTimeEntryDto } from './dto/submit-time-entry.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { photoMulterOptions } from '../uploads/multer-config';

@ApiTags('mobile')
@ApiBearerAuth('keycloak-jwt')
@Controller('mobile')
@Roles('irm-mitarbeiter', 'irm-admin', 'irm-disponent')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  // ─── Profil ────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Eigenes Mitarbeiterprofil + Tagesübersicht' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.mobileService.getProfile(user.sub);
  }

  // ─── Aufträge ──────────────────────────────────────────────────────────────

  @Get('my-orders')
  @ApiOperation({ summary: 'Eigene Aufträge (gefiltert, paginiert)' })
  findMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMyOrdersDto,
  ) {
    return this.mobileService.findMyOrders(user.sub, query);
  }

  @Get('my-orders/:id')
  @ApiOperation({ summary: 'Auftragsdetail mit Property, Fotos, Zeiteinträgen' })
  findMyOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mobileService.findMyOrder(user.sub, id);
  }

  // ─── Arbeit starten / stoppen ──────────────────────────────────────────────

  @Post('my-orders/:id/start')
  @ApiOperation({ summary: 'Arbeit starten — Status → IN_PROGRESS' })
  startWork(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: StartWorkDto,
  ) {
    return this.mobileService.startWork(user.sub, id);
  }

  @Post('my-orders/:id/stop')
  @ApiOperation({ summary: 'Arbeit beenden — Status → COMPLETED' })
  stopWork(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StopWorkDto,
  ) {
    return this.mobileService.stopWork(user.sub, id, dto);
  }

  // ─── Zeiteinträge ──────────────────────────────────────────────────────────

  @Post('my-orders/:id/time-entry')
  @ApiOperation({ summary: 'Manuelle Zeitrückmeldung erstellen' })
  submitTimeEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitTimeEntryDto,
  ) {
    return this.mobileService.submitTimeEntry(user.sub, id, dto);
  }

  // ─── Fotos ─────────────────────────────────────────────────────────────────

  @Post('my-orders/:id/photos')
  @ApiOperation({ summary: 'Fotos hochladen (max. 5, je max. 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        caption: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('photos', 5, photoMulterOptions))
  uploadPhotos(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadPhotoDto,
  ) {
    return this.mobileService.uploadPhotos(user.sub, id, files, dto);
  }

  @Get('my-orders/:id/photos')
  @ApiOperation({ summary: 'Fotos eines Auftrags auflisten' })
  getPhotos(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mobileService.getPhotos(user.sub, id);
  }

  @Delete('my-orders/:id/photos/:photoId')
  @ApiOperation({ summary: 'Foto löschen (nur eigene)' })
  deletePhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.mobileService.deletePhoto(user.sub, id, photoId);
  }

  @Get('photos/:photoId/file')
  @ApiOperation({ summary: 'Foto-Datei herunterladen' })
  async getPhotoFile(
    @CurrentUser() user: JwtPayload,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ) {
    const { path, mimeType, fileName } = await this.mobileService.getPhotoFile(
      user.sub,
      photoId,
    );

    if (!existsSync(path)) {
      res.status(404).json({ message: 'Datei nicht gefunden.' });
      return;
    }

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
    });

    const stream = createReadStream(path);
    stream.pipe(res);
  }
}
