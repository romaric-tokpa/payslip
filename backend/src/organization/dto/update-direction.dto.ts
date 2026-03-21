import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDirectionDto {
  @ApiProperty({ example: 'Direction générale' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
