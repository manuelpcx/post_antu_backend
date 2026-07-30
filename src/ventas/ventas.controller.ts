import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { AnularVentaDto } from './dto/anular-venta.dto';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  crear(@Body() dto: CrearVentaDto) {
    return this.ventasService.crear(dto);
  }

  @Get()
  findByFecha(@Query('fecha') fecha?: string) {
    if (!fecha) {
      throw new BadRequestException(
        'El parámetro fecha es obligatorio (YYYY-MM-DD)',
      );
    }
    return this.ventasService.findByFecha(fecha);
  }

  @Get('resumen')
  resumen(@Query('fecha') fecha?: string) {
    if (!fecha) {
      throw new BadRequestException(
        'El parámetro fecha es obligatorio (YYYY-MM-DD)',
      );
    }
    return this.ventasService.resumen(fecha);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ventasService.findOne(id);
  }

  @Patch(':id/anular')
  anular(@Param('id') id: string, @Body() dto: AnularVentaDto) {
    return this.ventasService.anular(id, dto);
  }
}
