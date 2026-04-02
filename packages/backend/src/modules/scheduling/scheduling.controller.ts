import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  SchedulingService,
  SuggestScheduleResponse,
  ReplanResponse,
  AvailabilityResponse,
} from './scheduling.service';
import { SuggestScheduleDto } from './dto/suggest-schedule.dto';
import { ReplanDto } from './dto/replan.dto';
import { AvailabilityQueryDto } from './dto/availability.dto';
import { Roles } from '../../common/decorators/roles.decorator';

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('scheduling')
@ApiBearerAuth('keycloak-jwt')
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  // POST /api/v1/scheduling/suggest
  @Post('suggest')
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Terminvorschläge generieren',
    description:
      'Berechnet optimale Terminvorschläge für einen Auftrag basierend auf ' +
      'Fähigkeiten, Verfügbarkeit, Entfernung und Saisonalität.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste von Terminvorschlägen, sortiert nach Score',
  })
  @ApiResponse({ status: 404, description: 'Tätigkeitstyp oder Immobilie nicht gefunden' })
  suggest(
    @Body() dto: SuggestScheduleDto,
  ): Promise<SuggestScheduleResponse> {
    return this.schedulingService.suggestSchedule(dto);
  }

  // POST /api/v1/scheduling/replan
  @Post('replan')
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Umplanung bei Ausfall',
    description:
      'Ermittelt betroffene Aufträge eines Mitarbeiters im Zeitraum und ' +
      'generiert alternative Terminvorschläge. Aufträge werden NICHT automatisch umgeplant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste betroffener Aufträge mit Alternativvorschlägen',
  })
  replan(
    @Body() dto: ReplanDto,
  ): Promise<ReplanResponse> {
    return this.schedulingService.replan(dto);
  }

  // GET /api/v1/scheduling/availability
  @Get('availability')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Verfügbarkeit eines Mitarbeiters abfragen',
    description:
      'Gibt für jeden Tag im Zeitraum zurück, ob der Mitarbeiter verfügbar ist, ' +
      'die Anzahl geplanter Aufträge und ggf. den Abwesenheitsgrund.',
  })
  @ApiQuery({ name: 'staffId', required: true, description: 'Mitarbeiter-UUID' })
  @ApiQuery({ name: 'from', required: true, description: 'Start-Datum (ISO 8601)' })
  @ApiQuery({ name: 'to', required: true, description: 'End-Datum (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Tagesweise Verfügbarkeit mit Auftragszählung',
  })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  getAvailability(
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponse> {
    return this.schedulingService.getAvailability(query);
  }
}
