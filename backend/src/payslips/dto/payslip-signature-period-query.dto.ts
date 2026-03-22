import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PayslipSignaturePeriodQueryDto {
  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ minimum: 2020, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;
}
