import { Module } from '@nestjs/common';
import { PropertiesController, MapController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  controllers: [PropertiesController, MapController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
