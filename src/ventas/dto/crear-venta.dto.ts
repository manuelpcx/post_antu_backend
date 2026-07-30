import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../../generated/prisma/enums';

export class CrearVentaItemDto {
  @IsString()
  productoId!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CrearVentaDto {
  @ValidateNested({ each: true })
  @Type(() => CrearVentaItemDto)
  @ArrayMinSize(1, { message: 'La venta debe tener al menos un ítem' })
  items!: CrearVentaItemDto[];

  @IsEnum(MetodoPago)
  metodoPago!: MetodoPago;
}
