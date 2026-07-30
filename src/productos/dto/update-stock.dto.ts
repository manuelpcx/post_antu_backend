import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  @NotEquals(0)
  cantidad!: number;

  @IsIn(['INGRESO', 'AJUSTE'])
  tipo!: 'INGRESO' | 'AJUSTE';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
