import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEspecieDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nombre!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: 'codigo solo puede contener letras y números',
  })
  codigo!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
