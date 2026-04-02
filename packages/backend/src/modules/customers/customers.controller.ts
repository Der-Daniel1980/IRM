import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService, PaginatedCustomers } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Customer } from '@prisma/client';

@ApiTags('customers')
@ApiBearerAuth('keycloak-jwt')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Kundenliste abrufen', description: 'Gibt eine paginierte Liste aller Kunden zurück. Unterstützt Suche und Filterung.' })
  @ApiQuery({ name: 'search', required: false, description: 'Volltextsuche über Firmenname, Ansprechpartner, Kundennummer und E-Mail' })
  @ApiQuery({ name: 'isInternal', required: false, type: Boolean, description: 'Filter: interne/externe Kunden' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter: aktive/inaktive Kunden (Standard: true)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite (Standard: 20, Max: 100)' })
  @ApiResponse({ status: 200, description: 'Kundenliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  @ApiResponse({ status: 403, description: 'Fehlende Berechtigung' })
  findAll(@Query() query: QueryCustomersDto): Promise<PaginatedCustomers> {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelnen Kunden abrufen' })
  @ApiParam({ name: 'id', description: 'Kunden-UUID' })
  @ApiResponse({ status: 200, description: 'Kunde erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Kunde nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Customer> {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neuen Kunden anlegen', description: 'Erstellt einen neuen Kunden mit automatischer Kundennummernvergabe (K-NNNNNNN).' })
  @ApiResponse({ status: 201, description: 'Kunde erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'Kundennummer bereits vergeben' })
  create(@Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Kunden aktualisieren' })
  @ApiParam({ name: 'id', description: 'Kunden-UUID' })
  @ApiResponse({ status: 200, description: 'Kunde erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Kunde nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Kunden deaktivieren (Soft Delete)', description: 'Setzt isActive=false. Kunden werden nicht physisch gelöscht.' })
  @ApiParam({ name: 'id', description: 'Kunden-UUID' })
  @ApiResponse({ status: 200, description: 'Kunde erfolgreich deaktiviert' })
  @ApiResponse({ status: 404, description: 'Kunde nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Customer> {
    return this.customersService.remove(id);
  }
}
