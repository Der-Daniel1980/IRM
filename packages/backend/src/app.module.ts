import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import appConfig from './common/config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['../../.env', '.env'],
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
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
  providers: [
    // Globaler Rate-Limiting-Guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Globaler JWT-Guard: alle Endpunkte sind standardmäßig geschützt
    // Ausnahmen: @Public() Decorator
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Globaler RBAC-Guard: prüft @Roles() Decorator
    { provide: APP_GUARD, useClass: RolesGuard },
    // Globaler Exception-Filter
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
