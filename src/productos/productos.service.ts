import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { FindProductosDto } from './dto/find-productos.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

const PRODUCTO_EMBED = {
  especie: { select: { id: true, nombre: true, color: true } },
  categoria: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoInclude;

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FindProductosDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where: Prisma.ProductoWhereInput = {
      activo: filters.activo,
      especieId: filters.especieId,
      categoriaId: filters.categoriaId,
      ...(filters.q
        ? {
            OR: [
              { sku: { contains: filters.q, mode: 'insensitive' } },
              { nombre: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.producto.findMany({
        where,
        include: PRODUCTO_EMBED,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.producto.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findBySku(sku: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { sku },
      include: PRODUCTO_EMBED,
    });
    if (!producto || !producto.activo) {
      throw new NotFoundException(
        `No existe un producto activo con SKU ${sku}`,
      );
    }
    return producto;
  }

  async buscar(q: string) {
    if (!q || q.trim().length === 0) {
      return [];
    }
    return this.prisma.producto.findMany({
      where: {
        activo: true,
        OR: [
          { sku: { contains: q, mode: 'insensitive' } },
          { nombre: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: PRODUCTO_EMBED,
      orderBy: { nombre: 'asc' },
      take: 20,
    });
  }

  async create(dto: CreateProductoDto) {
    const [especie, categoria] = await Promise.all([
      this.prisma.especie.findUnique({ where: { id: dto.especieId } }),
      this.prisma.categoria.findUnique({ where: { id: dto.categoriaId } }),
    ]);
    if (!especie || !especie.activo) {
      throw new BadRequestException(
        'La especie indicada no existe o está inactiva',
      );
    }
    if (!categoria || !categoria.activo) {
      throw new BadRequestException(
        'La categoría indicada no existe o está inactiva',
      );
    }

    try {
      return await this.prisma.producto.create({
        data: {
          sku: dto.sku.toUpperCase(),
          nombre: dto.nombre,
          especieId: dto.especieId,
          categoriaId: dto.categoriaId,
          valorNeto: dto.valorNeto,
          valorComision: dto.valorComision,
          precio: dto.valorNeto + dto.valorComision,
          stock: dto.stock,
          stockMinimo: dto.stockMinimo ?? 5,
          activo: dto.activo ?? true,
        },
        include: PRODUCTO_EMBED,
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateProductoDto) {
    const existing = await this.findOneOrThrow(id);

    if (dto.especieId) {
      const especie = await this.prisma.especie.findUnique({
        where: { id: dto.especieId },
      });
      if (!especie) {
        throw new BadRequestException('La especie indicada no existe');
      }
    }
    if (dto.categoriaId) {
      const categoria = await this.prisma.categoria.findUnique({
        where: { id: dto.categoriaId },
      });
      if (!categoria) {
        throw new BadRequestException('La categoría indicada no existe');
      }
    }

    const precioCambiado = dto.valorNeto !== undefined || dto.valorComision !== undefined;
    const valorNeto = dto.valorNeto ?? existing.valorNeto;
    const valorComision = dto.valorComision ?? existing.valorComision;

    try {
      return await this.prisma.producto.update({
        where: { id },
        data: {
          sku: dto.sku?.toUpperCase(),
          nombre: dto.nombre,
          especieId: dto.especieId,
          categoriaId: dto.categoriaId,
          valorNeto: dto.valorNeto,
          valorComision: dto.valorComision,
          precio: precioCambiado ? valorNeto + valorComision : undefined,
          stock: dto.stock,
          stockMinimo: dto.stockMinimo,
          activo: dto.activo,
        },
        include: PRODUCTO_EMBED,
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async updateStock(id: string, dto: UpdateStockDto) {
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id } });
      if (!producto) {
        throw new NotFoundException(`Producto ${id} no encontrado`);
      }

      const nuevoStock = producto.stock + dto.cantidad;
      if (nuevoStock < 0) {
        throw new BadRequestException('El ajuste dejaría el stock en negativo');
      }

      const actualizado = await tx.producto.update({
        where: { id },
        data: { stock: nuevoStock },
        include: PRODUCTO_EMBED,
      });

      await tx.movimientoStock.create({
        data: {
          productoId: id,
          tipo: dto.tipo,
          cantidad: dto.cantidad,
          stockResultante: nuevoStock,
          motivo: dto.motivo,
        },
      });

      return actualizado;
    });
  }

  private async findOneOrThrow(id: string) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    return producto;
  }

  private mapUniqueError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Ya existe un producto con ese SKU');
    }
    return error;
  }
}
