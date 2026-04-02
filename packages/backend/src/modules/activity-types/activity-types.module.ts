import { Module } from '@nestjs/common';
import { ActivityTypesController } from './activity-types.controller';
import { ActivityTypesService } from './activity-types.service';
import { SkillsModule } from '../skills/skills.module';
import { EquipmentModule } from '../equipment/equipment.module';

@Module({
  imports: [SkillsModule, EquipmentModule],
  controllers: [ActivityTypesController],
  providers: [ActivityTypesService],
  exports: [ActivityTypesService],
})
export class ActivityTypesModule {}
