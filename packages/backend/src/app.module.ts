import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { StaffModule } from './modules/staff/staff.module';
import { SkillsModule } from './modules/skills/skills.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { ActivityTypesModule } from './modules/activity-types/activity-types.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { AbsencesModule } from './modules/absences/absences.module';
import { FormulasModule } from './modules/formulas/formulas.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { RouteSheetsModule } from './modules/route-sheets/route-sheets.module';
import { MapModule } from './modules/map/map.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AdminModule } from './modules/admin/admin.module';
import appConfig from './common/config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['../../.env', '.env'],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        },
      }),
    }),
    PrismaModule,
    CustomersModule,
    PropertiesModule,
    StaffModule,
    SkillsModule,
    EquipmentModule,
    ActivityTypesModule,
    WorkOrdersModule,
    AbsencesModule,
    FormulasModule,
    SchedulingModule,
    RouteSheetsModule,
    MapModule,
    DashboardModule,
    AdminModule,
  ],
})
export class AppModule {}
