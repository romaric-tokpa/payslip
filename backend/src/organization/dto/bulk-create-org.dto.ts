import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BulkCreateDirectionItemDto {
  @ApiPropertyOptional({
    description:
      'UUID optionnel (côté client) pour lier départements créés dans le même lot',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class BulkCreateDepartmentItemDto {
  @ApiPropertyOptional({
    description:
      'UUID optionnel (côté client) pour lier services créés dans le même lot',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  directionId?: string;
}

export class BulkCreateServiceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class BulkCreateOrgDto {
  @ApiProperty({ type: [BulkCreateDirectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateDirectionItemDto)
  directions!: BulkCreateDirectionItemDto[];

  @ApiProperty({ type: [BulkCreateDepartmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateDepartmentItemDto)
  departments!: BulkCreateDepartmentItemDto[];

  @ApiProperty({ type: [BulkCreateServiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateServiceItemDto)
  services!: BulkCreateServiceItemDto[];
}

export class CreatedOrgEntityDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  id!: string;
}

export class BulkCreateOrgResponseDto {
  @ApiProperty({ type: [CreatedOrgEntityDto] })
  createdDirections!: CreatedOrgEntityDto[];

  @ApiProperty({ type: [CreatedOrgEntityDto] })
  createdDepartments!: CreatedOrgEntityDto[];

  @ApiProperty({ type: [CreatedOrgEntityDto] })
  createdServices!: CreatedOrgEntityDto[];

  @ApiProperty({ type: [CreatedOrgEntityDto] })
  reusedDirections!: CreatedOrgEntityDto[];

  @ApiProperty({ type: [CreatedOrgEntityDto] })
  reusedDepartments!: CreatedOrgEntityDto[];

  @ApiProperty({ type: [CreatedOrgEntityDto] })
  reusedServices!: CreatedOrgEntityDto[];
}
