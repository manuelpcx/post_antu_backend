import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activo?: boolean) {
    return this.prisma.categoria.findMany({
      where: activo === undefined ? undefined : { activo },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string) {
    const categoria = await this.prisma.categoria.findUnique({ where: { id } });
    if (!categoria) {
      throw new NotFoundException(`Categoría ${id} no encontrada`);
    }
    return categoria;
  }

  async create(dto: CreateCategoriaDto) {
    try {
      return await this.prisma.categoria.create({
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo.toUpperCase(),
          descripcion: dto.descripcion,
          orden: dto.orden ?? 0,
          activo: dto.activo ?? true,
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateCategoriaDto) {
    const categoria = await this.findOne(id);

    if (dto.activo === false && categoria.activo) {
      await this.assertSinProductosActivos(id);
    }

    try {
      return await this.prisma.categoria.update({
        where: { id },
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo?.toUpperCase(),
          descripcion: dto.descripcion,
          orden: dto.orden,
          activo: dto.activo,
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async softDelete(id: string) {
    const categoria = await this.findOne(id);
    if (categoria.activo) {
      await this.assertSinProductosActivos(id);
    }
    return this.prisma.categoria.update({
      where: { id },
      data: { activo: false },
    });
  }

  private async assertSinProductosActivos(id: string) {
    const count = await this.prisma.producto.count({
      where: { categoriaId: id, activo: true },
    });
    if (count > 0) {
      throw new ConflictException(
        `No se puede desactivar: ${count} producto${count === 1 ? '' : 's'} activo${count === 1 ? '' : 's'} ${count === 1 ? 'usa' : 'usan'} esta categoría.`,
      );
    }
  }

  private mapUniqueError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target =
        (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      return new ConflictException(`Ya existe una categoría con ese ${target}`);
    }
    return error;
  }
}
