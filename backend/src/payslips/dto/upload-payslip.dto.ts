import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class UploadPayslipDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant du collaborateur cible',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @ApiProperty({ minimum: 2020 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  periodYear: number;
}
