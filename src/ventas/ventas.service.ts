import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { diaSantiagoRangoUtc } from '../common/timezone';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { AnularVentaDto } from './dto/anular-venta.dto';

const VENTA_ITEMS_INCLUDE = { items: true } as const;

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearVentaDto) {
    return this.prisma.$transaction(async (tx) => {
      const productoIds = dto.items.map((item) => item.productoId);
      const productos = await tx.producto.findMany({
        where: { id: { in: productoIds } },
        include: { especie: true, categoria: true },
      });
      const productosPorId = new Map(productos.map((p) => [p.id, p]));

      let total = 0;
      const itemsData: {
        productoId: string;
        skuSnapshot: string;
        nombreSnapshot: string;
        especieNombreSnapshot: string;
        categoriaNombreSnapshot: string;
        especieId: string;
        categoriaId: string;
        precioUnitario: number;
        netoUnitario: number;
        comisionUnitario: number;
        cantidad: number;
        subtotal: number;
      }[] = [];

      for (const item of dto.items) {
        const producto = productosPorId.get(item.productoId);
        if (!producto) {
          throw new BadRequestException(
            `Producto ${item.productoId} no encontrado`,
          );
        }
        if (!producto.activo) {
          throw new BadRequestException(
            `El producto "${producto.nombre}" no está disponible`,
          );
        }

        const subtotal = producto.precio * item.cantidad;
        total += subtotal;

        itemsData.push({
          productoId: producto.id,
          skuSnapshot: producto.sku,
          nombreSnapshot: producto.nombre,
          especieNombreSnapshot: producto.especie.nombre,
          categoriaNombreSnapshot: producto.categoria.nombre,
          especieId: producto.especieId,
          categoriaId: producto.categoriaId,
          precioUnitario: producto.precio,
          netoUnitario: producto.valorNeto,
          comisionUnitario: producto.valorComision,
          cantidad: item.cantidad,
          subtotal,
        });
      }

      // 1. crear venta → 2. crear items (nested create, misma operación)
      const venta = await tx.venta.create({
        data: {
          total,
          metodoPago: dto.metodoPago,
          items: { create: itemsData },
        },
        include: VENTA_ITEMS_INCLUDE,
      });

      // 3. descontar stock (atómico, rechaza si insuficiente) → 4. registrar movimientos
      for (const item of venta.items) {
        const resultado = await tx.producto.updateMany({
          where: { id: item.productoId, stock: { gte: item.cantidad } },
          data: { stock: { decrement: item.cantidad } },
        });
        if (resultado.count === 0) {
          throw new BadRequestException(
            `Stock insuficiente para "${item.nombreSnapshot}"`,
          );
        }

        const productoActualizado = await tx.producto.findUniqueOrThrow({
          where: { id: item.productoId },
        });

        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            tipo: 'VENTA',
            cantidad: -item.cantidad,
            stockResultante: productoActualizado.stock,
            referenciaId: venta.id,
          },
        });
      }

      return venta;
    });
  }

  async resumen(fecha: string) {
    const { desde, hasta } = diaSantiagoRangoUtc(fecha);

    const [ventas, especies] = await Promise.all([
      this.prisma.venta.findMany({
        where: { createdAt: { gte: desde, lte: hasta }, estado: 'COMPLETADA' },
        include: VENTA_ITEMS_INCLUDE,
      }),
      this.prisma.especie.findMany({
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      }),
    ]);

    const cantidadVentas = ventas.length;
    const totalVendido = ventas.reduce((sum, v) => sum + v.total, 0);
    const ticketPromedio =
      cantidadVentas > 0 ? Math.round(totalVendido / cantidadVentas) : 0;
    const unidadesVendidas = ventas.reduce(
      (sum, v) => sum + v.items.reduce((s, i) => s + i.cantidad, 0),
      0,
    );
    const ventaNetaTotal = ventas.reduce(
      (sum, v) =>
        sum + v.items.reduce((s, i) => s + i.netoUnitario * i.cantidad, 0),
      0,
    );
    const ventaComisionTotal = ventas.reduce(
      (sum, v) =>
        sum +
        v.items.reduce((s, i) => s + i.comisionUnitario * i.cantidad, 0),
      0,
    );

    const metodoPagoMap = new Map<
      string,
      { total: number; cantidad: number }
    >();
    for (const venta of ventas) {
      const entry = metodoPagoMap.get(venta.metodoPago) ?? {
        total: 0,
        cantidad: 0,
      };
      entry.total += venta.total;
      entry.cantidad += 1;
      metodoPagoMap.set(venta.metodoPago, entry);
    }
    const porMetodoPago = [...metodoPagoMap.entries()].map(
      ([metodoPago, e]) => ({ metodoPago, ...e }),
    );

    const especieAcc = new Map<string, { total: number; unidades: number }>();
    for (const venta of ventas) {
      for (const item of venta.items) {
        const entry = especieAcc.get(item.especieId) ?? {
          total: 0,
          unidades: 0,
        };
        entry.total += item.subtotal;
        entry.unidades += item.cantidad;
        especieAcc.set(item.especieId, entry);
      }
    }
    const porEspecie = especies.map((especie) => ({
      especieId: especie.id,
      especieNombre: especie.nombre,
      color: especie.color,
      total: especieAcc.get(especie.id)?.total ?? 0,
      unidades: especieAcc.get(especie.id)?.unidades ?? 0,
    }));

    const productoAcc = new Map<
      string,
      { sku: string; nombre: string; unidades: number; total: number }
    >();
    for (const venta of ventas) {
      for (const item of venta.items) {
        const entry = productoAcc.get(item.productoId) ?? {
          sku: item.skuSnapshot,
          nombre: item.nombreSnapshot,
          unidades: 0,
          total: 0,
        };
        entry.unidades += item.cantidad;
        entry.total += item.subtotal;
        productoAcc.set(item.productoId, entry);
      }
    }
    const topProductos = [...productoAcc.entries()]
      .map(([productoId, e]) => ({ productoId, ...e }))
      .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
      .slice(0, 5);

    return {
      totalVendido,
      cantidadVentas,
      ticketPromedio,
      unidadesVendidas,
      ventaNetaTotal,
      ventaComisionTotal,
      porMetodoPago,
      porEspecie,
      topProductos,
    };
  }

  async findByFecha(fecha: string) {
    const { desde, hasta } = diaSantiagoRangoUtc(fecha);
    return this.prisma.venta.findMany({
      where: { createdAt: { gte: desde, lte: hasta } },
      orderBy: { numeroVenta: 'desc' },
    });
  }

  async findOne(id: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: VENTA_ITEMS_INCLUDE,
    });
    if (!venta) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }
    return venta;
  }

  async anular(id: string, dto: AnularVentaDto) {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id },
        include: VENTA_ITEMS_INCLUDE,
      });
      if (!venta) {
        throw new NotFoundException(`Venta ${id} no encontrada`);
      }
      if (venta.estado === 'ANULADA') {
        throw new ConflictException('La venta ya está anulada');
      }

      for (const item of venta.items) {
        const producto = await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { increment: item.cantidad } },
        });

        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            tipo: 'ANULACION',
            cantidad: item.cantidad,
            stockResultante: producto.stock,
            referenciaId: venta.id,
            motivo: dto.motivo,
          },
        });
      }

      return tx.venta.update({
        where: { id },
        data: { estado: 'ANULADA' },
        include: VENTA_ITEMS_INCLUDE,
      });
    });
  }
}
