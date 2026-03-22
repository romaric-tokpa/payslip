import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Ressources humaines' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Direction parente (optionnel). Si omis, le département est « sans direction ».',
  })
  @IsOptional()
  @IsUUID('4')
  directionId?: string;
}
