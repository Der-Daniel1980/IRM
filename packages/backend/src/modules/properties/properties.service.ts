import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { CreatePropertyUnitDto } from './dto/create-property-unit.dto';
import { UpdatePropertyUnitDto } from './dto/update-property-unit.dto';
import { Prisma, Property, PropertyUnit } from '@prisma/client';

// ─── Response-Typen ───────────────────────────────────────────────────────────

export interface PropertyWithUnits extends Property {
  units: PropertyUnit[];
}

export interface PaginatedProperties {
  data: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    id: string;
    propertyNumber: string;
    name: string;
    addressStreet: string;
    addressZip: string;
    addressCity: string;
    isActive: boolean;
    propertyType: string;
    unitsCount: number;
  };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ─── Raw SQL Ergebnis-Typen ───────────────────────────────────────────────────

interface GeoJsonRow {
  id: string;
  property_number: string;
  name: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  is_active: boolean;
  property_type: string;
  units_count: number;
  geo: string | null;
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Immobilien ──────────────────────────────────────────────────────────────

  async findAll(query: QueryPropertiesDto): Promise<PaginatedProperties> {
    const { search, customerId, propertyType, city, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {};

    // Standardmäßig aktive Immobilien anzeigen
    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      where.isActive = true;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (propertyType) {
      where.propertyType = propertyType;
    }

    if (city && city.trim().length > 0) {
      where.addressCity = { contains: city.trim(), mode: Prisma.QueryMode.insensitive };
    }

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { propertyNumber: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { addressStreet: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { addressCity: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { addressZip: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: { customer: { select: { id: true, companyName: true, customerNumber: true } } },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PropertyWithUnits> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        units: { orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }] },
        customer: { select: { id: true, companyName: true, customerNumber: true } },
      },
    });

    if (!property) {
      throw new NotFoundException(`Immobilie mit ID "${id}" wurde nicht gefunden`);
    }

    return property;
  }

  async create(dto: CreatePropertyDto): Promise<Property> {
    // Atomare Nummernvergabe
    const propertyNumber = await this.prisma.nextMasterDataNumber('OBJ', 7);

    this.logger.log(`Erstelle neue Immobilie: ${dto.name} (${propertyNumber})`);

    let property: Property;

    try {
      property = await this.prisma.property.create({
        data: {
          propertyNumber,
          customerId: dto.customerId,
          name: dto.name,
          addressStreet: dto.addressStreet,
          addressZip: dto.addressZip,
          addressCity: dto.addressCity,
          latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
          propertyType: dto.propertyType ?? 'RESIDENTIAL',
          totalAreaSqm: dto.totalAreaSqm !== undefined ? new Prisma.Decimal(dto.totalAreaSqm) : null,
          greenAreaSqm: dto.greenAreaSqm !== undefined ? new Prisma.Decimal(dto.greenAreaSqm) : null,
          floors: dto.floors ?? 1,
          notes: dto.notes,
          metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Eine Immobilie mit der Nummer "${propertyNumber}" existiert bereits`,
        );
      }
      throw error;
    }

    // geo_point via RAW SQL setzen, wenn Koordinaten vorhanden
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.setGeoPoint(property.id, dto.longitude, dto.latitude);
    }

    return property;
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
    await this.findOne(id);

    this.logger.log(`Aktualisiere Immobilie: ${id}`);

    const property = await this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.addressStreet !== undefined && { addressStreet: dto.addressStreet }),
        ...(dto.addressZip !== undefined && { addressZip: dto.addressZip }),
        ...(dto.addressCity !== undefined && { addressCity: dto.addressCity }),
        ...(dto.latitude !== undefined && { latitude: new Prisma.Decimal(dto.latitude) }),
        ...(dto.longitude !== undefined && { longitude: new Prisma.Decimal(dto.longitude) }),
        ...(dto.propertyType !== undefined && { propertyType: dto.propertyType }),
        ...(dto.totalAreaSqm !== undefined && { totalAreaSqm: new Prisma.Decimal(dto.totalAreaSqm) }),
        ...(dto.greenAreaSqm !== undefined && { greenAreaSqm: new Prisma.Decimal(dto.greenAreaSqm) }),
        ...(dto.floors !== undefined && { floors: dto.floors }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // geo_point aktualisieren wenn Koordinaten geändert
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.setGeoPoint(id, dto.longitude, dto.latitude);
    }

    return property;
  }

  async remove(id: string): Promise<Property> {
    await this.findOne(id);

    this.logger.log(`Deaktiviere Immobilie (Soft Delete): ${id}`);

    return this.prisma.property.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── GeoJSON für Karte ───────────────────────────────────────────────────────

  async getGeoJson(): Promise<GeoJsonFeatureCollection> {
    // Fallback auf latitude/longitude-Spalten, wenn geo_point noch nicht gesetzt
    // wurde (z.B. durch Prisma-Seed ohne RAW-SQL-Sync).
    const rows = await this.prisma.$queryRaw<GeoJsonRow[]>`
      SELECT
        id,
        property_number,
        name,
        address_street,
        address_zip,
        address_city,
        is_active,
        property_type,
        units_count,
        COALESCE(
          ST_AsGeoJSON(geo_point),
          CASE
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL
              THEN ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326))
            ELSE NULL
          END
        ) AS geo
      FROM properties
      WHERE is_active = true
        AND (geo_point IS NOT NULL OR (latitude IS NOT NULL AND longitude IS NOT NULL))
      ORDER BY name ASC
    `;

    const features: GeoJsonFeature[] = rows.map((row) => {
      const parsedGeo = row.geo ? (JSON.parse(row.geo) as { type: 'Point'; coordinates: [number, number] }) : null;
      return {
        type: 'Feature',
        geometry: parsedGeo,
        properties: {
          id: row.id,
          propertyNumber: row.property_number,
          name: row.name,
          addressStreet: row.address_street,
          addressZip: row.address_zip,
          addressCity: row.address_city,
          isActive: row.is_active,
          propertyType: row.property_type,
          unitsCount: Number(row.units_count),
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  // ─── Einheiten ───────────────────────────────────────────────────────────────

  async findUnits(propertyId: string): Promise<PropertyUnit[]> {
    await this.findOne(propertyId);

    return this.prisma.propertyUnit.findMany({
      where: { propertyId },
      orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }],
    });
  }

  async createUnit(propertyId: string, dto: CreatePropertyUnitDto): Promise<PropertyUnit> {
    await this.findOne(propertyId);

    this.logger.log(`Erstelle Einheit ${dto.unitNumber} für Immobilie: ${propertyId}`);

    const unit = await this.prisma.propertyUnit.create({
      data: {
        propertyId,
        unitNumber: dto.unitNumber,
        floor: dto.floor,
        tenantName: dto.tenantName,
        tenantPhone: dto.tenantPhone,
        usageType: dto.usageType ?? 'RESIDENTIAL',
        areaSqm: dto.areaSqm !== undefined ? new Prisma.Decimal(dto.areaSqm) : null,
        notes: dto.notes,
      },
    });

    await this.updateUnitsCount(propertyId);

    return unit;
  }

  async updateUnit(
    propertyId: string,
    unitId: string,
    dto: UpdatePropertyUnitDto,
  ): Promise<PropertyUnit> {
    await this.findOneUnit(propertyId, unitId);

    this.logger.log(`Aktualisiere Einheit ${unitId} der Immobilie: ${propertyId}`);

    return this.prisma.propertyUnit.update({
      where: { id: unitId },
      data: {
        ...(dto.unitNumber !== undefined && { unitNumber: dto.unitNumber }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.tenantName !== undefined && { tenantName: dto.tenantName }),
        ...(dto.tenantPhone !== undefined && { tenantPhone: dto.tenantPhone }),
        ...(dto.usageType !== undefined && { usageType: dto.usageType }),
        ...(dto.areaSqm !== undefined && { areaSqm: new Prisma.Decimal(dto.areaSqm) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async removeUnit(propertyId: string, unitId: string): Promise<PropertyUnit> {
    await this.findOneUnit(propertyId, unitId);

    this.logger.log(`Lösche Einheit ${unitId} der Immobilie: ${propertyId}`);

    const unit = await this.prisma.propertyUnit.delete({
      where: { id: unitId },
    });

    await this.updateUnitsCount(propertyId);

    return unit;
  }

  // ─── Private Hilfsmethoden ───────────────────────────────────────────────────

  private async findOneUnit(propertyId: string, unitId: string): Promise<PropertyUnit> {
    const unit = await this.prisma.propertyUnit.findFirst({
      where: { id: unitId, propertyId },
    });

    if (!unit) {
      throw new NotFoundException(
        `Einheit mit ID "${unitId}" wurde in Immobilie "${propertyId}" nicht gefunden`,
      );
    }

    return unit;
  }

  private async setGeoPoint(id: string, lng: number, lat: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE properties
      SET geo_point = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE id = ${id}::uuid
    `;
  }

  private async updateUnitsCount(propertyId: string): Promise<void> {
    const count = await this.prisma.propertyUnit.count({ where: { propertyId } });
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { unitsCount: count },
    });
  }
}
