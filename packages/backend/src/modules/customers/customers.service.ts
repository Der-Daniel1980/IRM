import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { Prisma, Customer } from '@prisma/client';

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCustomersDto): Promise<PaginatedCustomers> {
    const { search, isInternal, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    // Standardmäßig aktive Kunden anzeigen, außer explizit anders gewünscht
    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      where.isActive = true;
    }

    if (isInternal !== undefined) {
      where.isInternal = isInternal;
    }

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        {
          companyName: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          contactPerson: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          customerNumber: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Kunde mit ID "${id}" wurde nicht gefunden`);
    }

    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    // Atomare Nummernvergabe via PrismaService
    const customerNumber = await this.prisma.nextMasterDataNumber('K', 7);

    this.logger.log(`Erstelle neuen Kunden: ${dto.companyName} (${customerNumber})`);

    try {
      return await this.prisma.customer.create({
        data: {
          customerNumber,
          companyName: dto.companyName,
          isCompany: dto.isCompany,
          addressStreet: dto.addressStreet,
          addressZip: dto.addressZip,
          addressCity: dto.addressCity,
          addressCountry: dto.addressCountry ?? 'DE',
          phone: dto.phone,
          email: dto.email,
          contactPerson: dto.contactPerson,
          notes: dto.notes,
          isInternal: dto.isInternal ?? false,
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ein Kunde mit der Kundennummer "${customerNumber}" existiert bereits`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    // Existenz prüfen
    await this.findOne(id);

    this.logger.log(`Aktualisiere Kunde: ${id}`);

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.isCompany !== undefined && { isCompany: dto.isCompany }),
        ...(dto.addressStreet !== undefined && { addressStreet: dto.addressStreet }),
        ...(dto.addressZip !== undefined && { addressZip: dto.addressZip }),
        ...(dto.addressCity !== undefined && { addressCity: dto.addressCity }),
        ...(dto.addressCountry !== undefined && { addressCountry: dto.addressCountry }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isInternal !== undefined && { isInternal: dto.isInternal }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string): Promise<Customer> {
    // Existenz prüfen
    await this.findOne(id);

    this.logger.log(`Deaktiviere Kunde (Soft Delete): ${id}`);

    // Soft Delete: isActive = false
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
