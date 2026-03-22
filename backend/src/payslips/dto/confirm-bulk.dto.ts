import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmBulkAssignmentDto {
  @ApiProperty({
    description: 'Index du fichier dans le lot analysé (0-based)',
  })
  @IsInt()
  @Min(0)
  fileIndex: number;

  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @ApiProperty({ minimum: 1990 })
  @IsInt()
  @Min(1990)
  periodYear: number;
}

export class ConfirmBulkDto {
  @ApiProperty()
  @IsUUID()
  batchId: string;

  @ApiProperty({ type: [ConfirmBulkAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmBulkAssignmentDto)
  assignments: ConfirmBulkAssignmentDto[];
}
