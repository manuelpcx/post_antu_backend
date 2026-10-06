import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VentasService } from '../ventas/ventas.service';
import { diaSantiagoRangoUtc } from '../common/timezone';
import { calcularDesglose, Desglose } from './asesor.calculos';
import { ClaudeAsesorClient } from './asesor.claude';
import type { Consejo } from './asesor.prompt';

export interface AsesorRespuesta {
  desglose: Desglose;
  consejo: Consejo | null;
  modelo: string | null;
  generadoEn: Date | null;
}

@Injectable()
export class AsesorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ventasService: VentasService,
    private readonly claude: ClaudeAsesorClient,
  ) {}

  async obtener(fecha: string): Promise<AsesorRespuesta> {
    const [desglose, guardado] = await Promise.all([
      this.calcular(fecha),
      this.prisma.consejoDiario.findUnique({ where: { fecha } }),
    ]);
    return {
      desglose,
      consejo: (guardado?.consejo as Consejo | undefined) ?? null,
      modelo: guardado?.modelo ?? null,
      generadoEn: guardado?.updatedAt ?? null,
    };
  }

  async generar(fecha: string): Promise<AsesorRespuesta> {
    const desglose = await this.calcular(fecha);
    if (desglose.totalVendido === 0) {
      throw new BadRequestException(
        'No hay ventas para aconsejar en esta fecha',
      );
    }

    const { consejo, modelo } = await this.claude.generarConsejo(
      fecha,
      desglose,
    );
    const data = {
      desglose: desglose as unknown as Prisma.InputJsonValue,
      consejo: consejo as unknown as Prisma.InputJsonValue,
      modelo,
    };
    const guardado = await this.prisma.consejoDiario.upsert({
      where: { fecha },
      create: { fecha, ...data },
      update: data,
    });

    return {
      desglose,
      consejo,
      modelo: guardado.modelo,
      generadoEn: guardado.updatedAt,
    };
  }

  private async calcular(fecha: string): Promise<Desglose> {
    const { desde, hasta } = diaSantiagoRangoUtc(fecha);
    const [resumen, items] = await Promise.all([
      this.ventasService.resumen(fecha),
      this.prisma.ventaItem.findMany({
        where: {
          venta: {
            createdAt: { gte: desde, lte: hasta },
            estado: 'COMPLETADA',
          },
        },
        select: {
          productoId: true,
          skuSnapshot: true,
          nombreSnapshot: true,
          precioUnitario: true,
          comisionUnitario: true,
          cantidad: true,
        },
      }),
    ]);
    return calcularDesglose(resumen, items);
  }
}
