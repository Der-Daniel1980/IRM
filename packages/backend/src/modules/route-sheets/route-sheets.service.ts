import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, RouteSheetStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRouteSheetDto } from './dto/create-route-sheet.dto';
import { UpdateRouteSheetDto } from './dto/update-route-sheet.dto';
import { QueryRouteSheetsDto } from './dto/query-route-sheets.dto';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type RouteSheetItemWithWorkOrder = Prisma.RouteSheetItemGetPayload<{
  include: {
    workOrder: {
      include: {
        property: {
          include: { units: true };
        };
        activityType: true;
        customer: true;
      };
    };
  };
}>;

export type RouteSheetWithItems = Prisma.RouteSheetGetPayload<{
  include: {
    items: {
      include: {
        workOrder: {
          include: {
            property: {
              include: { units: true };
            };
            activityType: true;
            customer: true;
          };
        };
      };
      orderBy: { position: 'asc' };
    };
  };
}>;

export interface PaginatedRouteSheets {
  data: RouteSheetWithItems[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// PostGIS Distanz-Query Ergebnis
interface DistanceResult {
  dist_km: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const PDF_DIR = '/tmp/irm-pdfs';

function ensurePdfDir(): void {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RouteSheetsService {
  private readonly logger = new Logger(RouteSheetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Alle Laufzettel abrufen ──────────────────────────────────────────────

  async findAll(query: QueryRouteSheetsDto): Promise<PaginatedRouteSheets> {
    const { staffId, date, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.RouteSheetWhereInput = {};

    if (staffId) {
      where.staffId = staffId;
    }

    if (date) {
      // Suche nach einem ganzen Tag
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    if (status) {
      where.status = status as RouteSheetStatus;
    }

    const includeItems = {
      items: {
        include: {
          workOrder: {
            include: {
              property: { include: { units: true } },
              activityType: true,
              customer: true,
            },
          },
        },
        orderBy: { position: 'asc' as const },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.routeSheet.findMany({
        where,
        include: includeItems,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.routeSheet.count({ where }),
    ]);

    return {
      data: data as RouteSheetWithItems[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Einzelnen Laufzettel abrufen ─────────────────────────────────────────

  async findOne(id: string): Promise<RouteSheetWithItems> {
    const sheet = await this.prisma.routeSheet.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            workOrder: {
              include: {
                property: { include: { units: true } },
                activityType: true,
                customer: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!sheet) {
      throw new NotFoundException(`Laufzettel ${id} nicht gefunden`);
    }

    return sheet as RouteSheetWithItems;
  }

  // ─── Laufzettel erstellen ─────────────────────────────────────────────────

  async create(dto: CreateRouteSheetDto): Promise<RouteSheetWithItems> {
    // Mitarbeiter prüfen
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff) {
      throw new NotFoundException(`Mitarbeiter ${dto.staffId} nicht gefunden`);
    }

    // Fahrzeug prüfen (optional)
    if (dto.vehicleId) {
      const vehicle = await this.prisma.equipment.findUnique({
        where: { id: dto.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException(`Fahrzeug ${dto.vehicleId} nicht gefunden`);
      }
    }

    // Aufträge laden (mit Immobilien-Koordinaten)
    const workOrders = await this.prisma.workOrder.findMany({
      where: { id: { in: dto.workOrderIds } },
      include: {
        property: { include: { units: true } },
        activityType: true,
        customer: true,
      },
    });

    if (workOrders.length !== dto.workOrderIds.length) {
      const foundIds = workOrders.map((w) => w.id);
      const missing = dto.workOrderIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(`Aufträge nicht gefunden: ${missing.join(', ')}`);
    }

    // Aufträge in der gewünschten Reihenfolge sortieren
    const orderedWorkOrders = dto.workOrderIds.map((id) => {
      const wo = workOrders.find((w) => w.id === id);
      if (!wo) throw new BadRequestException(`Auftrag ${id} nicht gefunden`);
      return wo;
    });

    // Fahrzeiten berechnen (PostGIS falls Koordinaten vorhanden)
    const travelData = await this.calculateTravelData(orderedWorkOrders);

    // Gesamtdauer = Summe geplante Dauer + Fahrzeiten
    const workDurationMin = orderedWorkOrders.reduce(
      (sum, wo) => sum + (wo.plannedDurationMin ?? 0),
      0,
    );
    const totalTravelMin = travelData.reduce((sum, t) => sum + t.travelTimeMin, 0);
    const totalDurationMin = workDurationMin + totalTravelMin;

    // Gesamtstrecke
    const totalDistanceKm = travelData.reduce((sum, t) => sum + t.distanceKm, 0);

    // Nummernvergabe via NumberSequenceService (T=2 für Laufzettel)
    const sheetNumber = await this.prisma.nextSequenceNumber(2);

    // Laufzettel in einer Transaktion anlegen
    const sheet = await this.prisma.$transaction(async (tx) => {
      const created = await tx.routeSheet.create({
        data: {
          sheetNumber,
          staffId: dto.staffId,
          vehicleId: dto.vehicleId ?? null,
          date: new Date(dto.date),
          status: RouteSheetStatus.DRAFT,
          totalDurationMin,
          totalDistanceKm:
            totalDistanceKm > 0 ? new Prisma.Decimal(totalDistanceKm.toFixed(2)) : null,
          items: {
            create: orderedWorkOrders.map((wo, idx) => ({
              workOrderId: wo.id,
              position: idx + 1,
              travelTimeMin: travelData[idx]?.travelTimeMin ?? null,
              distanceKm:
                travelData[idx]?.distanceKm > 0
                  ? new Prisma.Decimal(travelData[idx].distanceKm.toFixed(2))
                  : null,
            })),
          },
        },
        include: {
          items: {
            include: {
              workOrder: {
                include: {
                  property: { include: { units: true } },
                  activityType: true,
                  customer: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });

      return created;
    });

    this.logger.log(`Laufzettel ${sheetNumber} erstellt (${orderedWorkOrders.length} Aufträge)`);
    return sheet as RouteSheetWithItems;
  }

  // ─── Laufzettel aktualisieren ─────────────────────────────────────────────

  async update(id: string, dto: UpdateRouteSheetDto): Promise<RouteSheetWithItems> {
    const sheet = await this.findOne(id);

    // Status-Übergänge validieren
    if (dto.status !== undefined) {
      const current = sheet.status;
      const allowed: Record<string, string[]> = {
        DRAFT: ['ISSUED'],
        ISSUED: ['IN_PROGRESS', 'DRAFT'],
        IN_PROGRESS: ['COMPLETED'],
        COMPLETED: [],
      };
      if (!allowed[current]?.includes(dto.status)) {
        throw new BadRequestException(
          `Statusübergang von ${current} nach ${dto.status} nicht erlaubt`,
        );
      }
    }

    // Fahrzeug prüfen (optional)
    if (dto.vehicleId) {
      const vehicle = await this.prisma.equipment.findUnique({
        where: { id: dto.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException(`Fahrzeug ${dto.vehicleId} nicht gefunden`);
      }
    }

    // Reihenfolge neu berechnen wenn workOrderIds geändert werden
    let itemsUpdate: Prisma.RouteSheetUpdateInput['items'] | undefined;
    let totalDurationMin: number | undefined;
    let totalDistanceKm: number | undefined;

    if (dto.workOrderIds !== undefined) {
      const workOrders = await this.prisma.workOrder.findMany({
        where: { id: { in: dto.workOrderIds } },
        include: {
          property: { include: { units: true } },
          activityType: true,
          customer: true,
        },
      });

      if (workOrders.length !== dto.workOrderIds.length) {
        const foundIds = workOrders.map((w) => w.id);
        const missing = dto.workOrderIds.filter((wid) => !foundIds.includes(wid));
        throw new BadRequestException(`Aufträge nicht gefunden: ${missing.join(', ')}`);
      }

      const ordered = dto.workOrderIds.map((wid) => {
        const wo = workOrders.find((w) => w.id === wid);
        if (!wo) throw new BadRequestException(`Auftrag ${wid} nicht gefunden`);
        return wo;
      });

      const travelData = await this.calculateTravelData(ordered);

      const workMin = ordered.reduce((sum, wo) => sum + (wo.plannedDurationMin ?? 0), 0);
      const travelMin = travelData.reduce((sum, t) => sum + t.travelTimeMin, 0);
      totalDurationMin = workMin + travelMin;
      totalDistanceKm = travelData.reduce((sum, t) => sum + t.distanceKm, 0);

      itemsUpdate = {
        deleteMany: {},
        create: ordered.map((wo, idx) => ({
          workOrderId: wo.id,
          position: idx + 1,
          travelTimeMin: travelData[idx]?.travelTimeMin ?? null,
          distanceKm:
            travelData[idx]?.distanceKm > 0
              ? new Prisma.Decimal(travelData[idx].distanceKm.toFixed(2))
              : null,
        })),
      };
    }

    const updateData: Prisma.RouteSheetUpdateInput = {};

    if (dto.vehicleId !== undefined) {
      updateData.vehicleId = dto.vehicleId;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status as RouteSheetStatus;
    }
    if (totalDurationMin !== undefined) {
      updateData.totalDurationMin = totalDurationMin;
    }
    if (totalDistanceKm !== undefined) {
      updateData.totalDistanceKm =
        totalDistanceKm > 0 ? new Prisma.Decimal(totalDistanceKm.toFixed(2)) : null;
    }
    if (itemsUpdate !== undefined) {
      updateData.items = itemsUpdate;
    }

    const updated = await this.prisma.routeSheet.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            workOrder: {
              include: {
                property: { include: { units: true } },
                activityType: true,
                customer: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    return updated as RouteSheetWithItems;
  }

  // ─── Laufzettel löschen (nur DRAFT) ──────────────────────────────────────

  async remove(id: string): Promise<void> {
    const sheet = await this.findOne(id);

    if (sheet.status !== RouteSheetStatus.DRAFT) {
      throw new BadRequestException(
        `Laufzettel kann nur im Status DRAFT gelöscht werden (aktuell: ${sheet.status})`,
      );
    }

    await this.prisma.routeSheet.delete({ where: { id } });
    this.logger.log(`Laufzettel ${sheet.sheetNumber} gelöscht`);
  }

  // ─── PDF generieren ───────────────────────────────────────────────────────

  async generatePdf(id: string): Promise<{ filePath: string; sheetNumber: string }> {
    const sheet = await this.findOne(id);

    // Mitarbeiter- und Fahrzeug-Details laden
    const staff = await this.prisma.staff.findUnique({
      where: { id: sheet.staffId },
    });

    const vehicle = sheet.vehicleId
      ? await this.prisma.equipment.findUnique({ where: { id: sheet.vehicleId } })
      : null;

    const staffName = staff
      ? `${staff.firstName} ${staff.lastName}`
      : 'Unbekannt';

    const vehicleName = vehicle
      ? `${vehicle.name}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ''}`
      : '-';

    const dateStr = formatDate(sheet.date);
    const orderedItems = [...sheet.items].sort((a, b) => a.position - b.position);

    // HTML-Template aufbauen
    const orderBlocks = orderedItems
      .map((item, idx) => {
        const wo = item.workOrder;
        const prop = wo.property;
        const address = `${prop.addressStreet}, ${prop.addressZip} ${prop.addressCity}`;
        const duration = wo.plannedDurationMin
          ? formatMinutes(wo.plannedDurationMin)
          : 'Nicht festgelegt';
        const startTime = wo.plannedStartTime
          ? new Date(wo.plannedStartTime).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-';

        // Mieterliste für Reinigungsaufträge (Kategorie REINIGUNG)
        const isReinigung =
          wo.activityType.category?.toUpperCase().includes('REINIGUNG') ||
          wo.activityType.code?.toUpperCase().includes('REINIGUNG') ||
          wo.activityType.name?.toUpperCase().includes('TREPPEN');

        const unitsHtml =
          isReinigung && prop.units && prop.units.length > 0
            ? `
              <table class="tenant-table" style="margin-top:8px;">
                <thead>
                  <tr>
                    <th>Einheit</th>
                    <th>Etage</th>
                    <th>Mieter</th>
                    <th>Erledigt</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...prop.units]
                    .sort((a, b) => a.floor.localeCompare(b.floor, 'de', { numeric: true }))
                    .map(
                      (unit) => `
                    <tr>
                      <td>${unit.unitNumber}</td>
                      <td>${unit.floor}</td>
                      <td>${unit.tenantName ?? '-'}</td>
                      <td style="width:40px;text-align:center;">&#9633;</td>
                    </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>`
            : '';

        // Fahrzeit-Trennbereich (zwischen Aufträgen)
        const travelHtml =
          idx > 0 && item.travelTimeMin
            ? `<div class="travel">&#8595; Fahrzeit: ${formatMinutes(item.travelTimeMin)}${item.distanceKm ? ` (${Number(item.distanceKm).toFixed(1)} km)` : ''} &#8595;</div>`
            : '';

        return `
          ${travelHtml}
          <div class="order-block">
            <table style="width:100%;margin-bottom:6px;">
              <tr>
                <td><b>Pos. ${item.position}</b> &nbsp; <b>${wo.orderNumber}</b></td>
                <td style="text-align:right;color:#666;">${wo.activityType.name}</td>
              </tr>
              <tr>
                <td colspan="2"><b>${wo.title}</b></td>
              </tr>
              <tr>
                <td><b>Objekt:</b> ${prop.name}</td>
                <td style="text-align:right;">${wo.customer.companyName}</td>
              </tr>
              <tr>
                <td colspan="2"><b>Adresse:</b> ${address}</td>
              </tr>
              <tr>
                <td><b>Startzeit:</b> ${startTime}</td>
                <td style="text-align:right;"><b>Dauer:</b> ${duration}</td>
              </tr>
              ${
                wo.description
                  ? `<tr><td colspan="2" style="padding-top:4px;color:#444;font-style:italic;">${wo.description}</td></tr>`
                  : ''
              }
            </table>
            ${unitsHtml}
            <div style="margin-top:8px;border-top:1px dashed #ccc;padding-top:6px;font-size:10px;color:#666;">
              Beginn: _________ &nbsp;&nbsp; Ende: _________ &nbsp;&nbsp; Unterschrift: _______________________
            </div>
          </div>`;
      })
      .join('\n');

    const totalDuration = sheet.totalDurationMin ? formatMinutes(sheet.totalDurationMin) : '-';
    const totalTravel = orderedItems.reduce((s, i) => s + (i.travelTimeMin ?? 0), 0);
    const travelStr = totalTravel > 0 ? formatMinutes(totalTravel) : '-';
    const distanceStr = sheet.totalDistanceKm
      ? `${Number(sheet.totalDistanceKm).toFixed(1)} km`
      : '-';

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #222; }
    .header { border: 2px solid #333; padding: 10px; margin-bottom: 15px; }
    .header h2 { margin: 0 0 8px 0; font-size: 18px; letter-spacing: 2px; }
    .order-block { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
    .travel { text-align: center; color: #666; margin: 5px 0; font-style: italic; font-size: 11px; }
    .summary { border-top: 2px solid #333; margin-top: 15px; padding-top: 10px; font-size: 11px; }
    .tenant-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .tenant-table td, .tenant-table th { border: 1px solid #ddd; padding: 3px 6px; }
    .tenant-table th { background: #f5f5f5; font-weight: bold; }
    table { border-collapse: collapse; }
    @media print { .order-block { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h2>LAUFZETTEL</h2>
    <table style="width:100%">
      <tr>
        <td><b>Mitarbeiter:</b> ${staffName}</td>
        <td><b>Datum:</b> ${dateStr}</td>
      </tr>
      <tr>
        <td><b>KFZ:</b> ${vehicleName}</td>
        <td><b>Blatt-Nr.:</b> ${sheet.sheetNumber}</td>
      </tr>
    </table>
  </div>

  ${orderBlocks}

  <div class="summary">
    <b>Zusammenfassung:</b> ${orderedItems.length} Auftrag${orderedItems.length !== 1 ? 'e' : ''} &nbsp;|&nbsp;
    Gesamtdauer: ${totalDuration} &nbsp;|&nbsp;
    Fahrzeit: ${travelStr} &nbsp;|&nbsp;
    Strecke: ${distanceStr}
  </div>

  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:10px;font-size:10px;color:#999;">
    Erstellt: ${new Date().toLocaleString('de-DE')} &nbsp;|&nbsp; IRM-System
  </div>
</body>
</html>`;

    // PDF-Verzeichnis sicherstellen
    ensurePdfDir();

    const fileName = `laufzettel-${sheet.sheetNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    // Puppeteer PDF generieren
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    // PDF-Pfad in der Datenbank speichern
    await this.prisma.routeSheet.update({
      where: { id },
      data: { pdfPath: filePath },
    });

    this.logger.log(`PDF generiert: ${filePath}`);
    return { filePath, sheetNumber: sheet.sheetNumber };
  }

  // ─── Fahrzeiten berechnen (PostGIS) ───────────────────────────────────────

  private async calculateTravelData(
    workOrders: Array<{
      property: { id: string; latitude: unknown; longitude: unknown };
      plannedDurationMin: number | null;
    }>,
  ): Promise<Array<{ travelTimeMin: number; distanceKm: number }>> {
    const result: Array<{ travelTimeMin: number; distanceKm: number }> = [];

    for (let i = 0; i < workOrders.length; i++) {
      // Erster Auftrag hat keine Anfahrt
      if (i === 0) {
        result.push({ travelTimeMin: 0, distanceKm: 0 });
        continue;
      }

      const prevProp = workOrders[i - 1].property;
      const currProp = workOrders[i].property;

      // PostGIS-Distanz berechnen wenn geo_point gesetzt
      let distanceKm = 0;
      try {
        const distResult = await this.prisma.$queryRaw<DistanceResult[]>`
          SELECT ST_Distance(
            p1.geo_point::geography,
            p2.geo_point::geography
          ) / 1000 AS dist_km
          FROM properties p1, properties p2
          WHERE p1.id = ${prevProp.id}::uuid
            AND p2.id = ${currProp.id}::uuid
            AND p1.geo_point IS NOT NULL
            AND p2.geo_point IS NOT NULL
        `;

        if (distResult.length > 0 && distResult[0].dist_km != null) {
          distanceKm = Number(distResult[0].dist_km);
        } else {
          // Fallback: Haversine-Schätzung aus latitude/longitude Feldern
          distanceKm = this.haversineDistance(prevProp, currProp);
        }
      } catch {
        // Bei Fehler (PostGIS nicht verfügbar) Koordinaten-Fallback
        distanceKm = this.haversineDistance(prevProp, currProp);
      }

      // Fahrzeit schätzen: 30 km/h Durchschnitt (Stadtverkehr)
      const travelTimeMin = distanceKm > 0 ? Math.round((distanceKm / 30) * 60) : 0;

      result.push({ travelTimeMin, distanceKm });
    }

    return result;
  }

  // ─── Haversine-Fallback (ohne PostGIS) ───────────────────────────────────

  private haversineDistance(
    from: { latitude: unknown; longitude: unknown },
    to: { latitude: unknown; longitude: unknown },
  ): number {
    const lat1 = Number(from.latitude);
    const lon1 = Number(from.longitude);
    const lat2 = Number(to.latitude);
    const lon2 = Number(to.longitude);

    if (
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2) ||
      lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0
    ) {
      return 0;
    }

    const R = 6371; // Erdradius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
