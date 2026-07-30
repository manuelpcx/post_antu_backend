import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @MinLength(3)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'sku solo puede contener letras, números y guiones',
  })
  sku!: string;

  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsString()
  especieId!: string;

  @IsString()
  categoriaId!: string;

  @IsInt()
  @Min(1)
  precio!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
