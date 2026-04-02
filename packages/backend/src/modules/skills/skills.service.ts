import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { QuerySkillsDto } from './dto/query-skills.dto';
import { Prisma, Skill } from '@prisma/client';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QuerySkillsDto): Promise<Skill[]> {
    const where: Prisma.SkillWhereInput = {};

    if (query.category && query.category.trim().length > 0) {
      where.category = {
        contains: query.category.trim(),
        mode: Prisma.QueryMode.insensitive,
      };
    }

    return this.prisma.skill.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Skill> {
    const skill = await this.prisma.skill.findUnique({ where: { id } });

    if (!skill) {
      throw new NotFoundException(`Fähigkeit mit ID "${id}" wurde nicht gefunden`);
    }

    return skill;
  }

  async create(dto: CreateSkillDto): Promise<Skill> {
    this.logger.log(`Erstelle neue Fähigkeit: ${dto.name}`);

    try {
      return await this.prisma.skill.create({
        data: {
          name: dto.name,
          category: dto.category,
          description: dto.description,
          requiresCertification: dto.requiresCertification ?? false,
          icon: dto.icon ?? 'Star',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Eine Fähigkeit mit dem Namen "${dto.name}" existiert bereits`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSkillDto): Promise<Skill> {
    await this.findOne(id);

    this.logger.log(`Aktualisiere Fähigkeit: ${id}`);

    try {
      return await this.prisma.skill.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.requiresCertification !== undefined && {
            requiresCertification: dto.requiresCertification,
          }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Eine Fähigkeit mit diesem Namen existiert bereits`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Skill> {
    await this.findOne(id);

    // Prüfen ob Mitarbeiter diese Fähigkeit haben
    const usageCount = await this.prisma.staffSkill.count({
      where: { skillId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Die Fähigkeit kann nicht gelöscht werden, da sie ${usageCount} Mitarbeiter(n) zugeordnet ist`,
      );
    }

    this.logger.log(`Lösche Fähigkeit: ${id}`);

    return this.prisma.skill.delete({ where: { id } });
  }
}
