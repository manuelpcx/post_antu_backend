import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnularVentaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
