import { Module } from '@nestjs/common';
import { RouteSheetsController } from './route-sheets.controller';
import { RouteSheetsService } from './route-sheets.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RouteSheetsController],
  providers: [RouteSheetsService],
  exports: [RouteSheetsService],
})
export class RouteSheetsModule {}
