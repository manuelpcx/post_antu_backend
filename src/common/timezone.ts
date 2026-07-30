import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export const BUSINESS_TZ = 'America/Santiago';

export function diaSantiagoRangoUtc(fecha: string): {
  desde: Date;
  hasta: Date;
} {
  const inicio = DateTime.fromISO(fecha, { zone: BUSINESS_TZ }).startOf('day');
  if (!inicio.isValid) {
    throw new BadRequestException('Fecha inválida, use formato YYYY-MM-DD');
  }
  return {
    desde: inicio.toUTC().toJSDate(),
    hasta: inicio.endOf('day').toUTC().toJSDate(),
  };
}
