import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService, DashboardStats, TodayOrderItem, StaffStatusItem, MaintenanceDueItem } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('dashboard')
@ApiBearerAuth('keycloak-jwt')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // GET /api/v1/dashboard/stats
  @Get('stats')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Dashboard-Kennzahlen abrufen',
    description:
      'Liefert alle Kennzahlen für das Dashboard in einem einzigen API-Call: heutige Aufträge, ' +
      'Mitarbeiterverfügbarkeit, offene und urgente Aufträge, Abwesenheiten und fällige Wartungen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kennzahlen erfolgreich abgerufen',
  })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  getStats(): Promise<DashboardStats> {
    return this.dashboardService.getStats();
  }

  // GET /api/v1/dashboard/today
  @Get('today')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Heutige Aufträge mit Details',
    description:
      'Gibt alle für heute geplanten Aufträge zurück, inklusive Immobilien- und Tätigkeitsinformationen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Heutige Aufträge erfolgreich abgerufen',
  })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  getTodayOrders(): Promise<TodayOrderItem[]> {
    return this.dashboardService.getTodayOrders();
  }

  // GET /api/v1/dashboard/staff-status
  @Get('staff-status')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Mitarbeiter-Status für heute',
    description:
      'Gibt den heutigen Status aller aktiven Mitarbeiter zurück: Verfügbar, Im Einsatz oder Abwesend.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mitarbeiter-Status erfolgreich abgerufen',
  })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  getStaffStatus(): Promise<StaffStatusItem[]> {
    return this.dashboardService.getStaffStatus();
  }

  // GET /api/v1/dashboard/maintenance-due
  @Get('maintenance-due')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Fällige Wartungen abrufen',
    description:
      'Gibt alle Geräte zurück, deren Wartungstermin innerhalb der nächsten 7 Tage liegt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wartungsliste erfolgreich abgerufen',
  })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  getMaintenanceDue(): Promise<MaintenanceDueItem[]> {
    return this.dashboardService.getMaintenanceDue();
  }
}
