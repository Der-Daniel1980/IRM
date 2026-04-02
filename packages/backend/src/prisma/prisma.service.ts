import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Atomare Nummernvergabe via SELECT FOR UPDATE
   * Format YYYY-TNNNNNNNN (z.B. 2026-10000001)
   */
  async nextSequenceNumber(typeDigit: number): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ next_val: bigint }[]>`
        INSERT INTO number_sequences (year, type_digit, last_number)
        VALUES (${year}, ${typeDigit}, 1)
        ON CONFLICT (year, type_digit)
        DO UPDATE SET last_number = number_sequences.last_number + 1
        RETURNING last_number AS next_val
      `;
      return seq[0].next_val;
    });
    const padded = result.toString().padStart(7, '0');
    return `${year}-${typeDigit}${padded}`;
  }

  /**
   * Atomare Stammdaten-Nummernvergabe
   * Format: prefix + 7-stellige Zahl (z.B. K-0000001, OBJ-0000001, MA-0001, GER-0001)
   */
  async nextMasterDataNumber(
    prefix: string,
    padLength: number = 7,
  ): Promise<string> {
    const result = await this.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ next_val: bigint }[]>`
        INSERT INTO master_data_sequences (prefix, last_number)
        VALUES (${prefix}, 1)
        ON CONFLICT (prefix)
        DO UPDATE SET last_number = master_data_sequences.last_number + 1
        RETURNING last_number AS next_val
      `;
      return seq[0].next_val;
    });
    const padded = result.toString().padStart(padLength, '0');
    return `${prefix}-${padded}`;
  }
}
