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
  valorNeto!: number;

  // Required (not optional) deliberately: ProductosService.create() computes
  // precio as dto.valorNeto + dto.valorComision, which would be NaN if this
  // were undefined. The Prisma schema's `@default(0)` on valorComision is
  // unrelated to this API contract — it only exists to support the backfill
  // migration for rows that pre-date this column.
  @IsInt()
  @Min(0)
  valorComision!: number;

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
