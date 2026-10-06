import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { AsesorService } from './asesor.service';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(fecha?: string): string {
  if (!fecha || !FECHA_REGEX.test(fecha)) {
    throw new BadRequestException(
      'El parámetro fecha es obligatorio (YYYY-MM-DD)',
    );
  }
  return fecha;
}

@Controller('asesor')
export class AsesorController {
  constructor(private readonly asesorService: AsesorService) {}

  @Get('consejo')
  obtener(@Query('fecha') fecha?: string) {
    return this.asesorService.obtener(validarFecha(fecha));
  }

  @Post('consejo')
  generar(@Query('fecha') fecha?: string) {
    return this.asesorService.generar(validarFecha(fecha));
  }
}
