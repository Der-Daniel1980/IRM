import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyUnitDto } from './create-property-unit.dto';

export class UpdatePropertyUnitDto extends PartialType(CreatePropertyUnitDto) {}
