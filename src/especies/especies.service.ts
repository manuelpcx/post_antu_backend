import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEspecieDto } from './dto/create-especie.dto';
import { UpdateEspecieDto } from './dto/update-especie.dto';

@Injectable()
export class EspeciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activo?: boolean) {
    return this.prisma.especie.findMany({
      where: activo === undefined ? undefined : { activo },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string) {
    const especie = await this.prisma.especie.findUnique({ where: { id } });
    if (!especie) {
      throw new NotFoundException(`Especie ${id} no encontrada`);
    }
    return especie;
  }

  async create(dto: CreateEspecieDto) {
    try {
      return await this.prisma.especie.create({
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo.toUpperCase(),
          color: dto.color,
          orden: dto.orden ?? 0,
          activo: dto.activo ?? true,
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateEspecieDto) {
    const especie = await this.findOne(id);

    if (dto.activo === false && especie.activo) {
      await this.assertSinProductosActivos(id);
    }

    try {
      return await this.prisma.especie.update({
        where: { id },
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo?.toUpperCase(),
          color: dto.color,
          orden: dto.orden,
          activo: dto.activo,
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async softDelete(id: string) {
    const especie = await this.findOne(id);
    if (especie.activo) {
      await this.assertSinProductosActivos(id);
    }
    return this.prisma.especie.update({
      where: { id },
      data: { activo: false },
    });
  }

  private async assertSinProductosActivos(id: string) {
    const count = await this.prisma.producto.count({
      where: { especieId: id, activo: true },
    });
    if (count > 0) {
      throw new ConflictException(
        `No se puede desactivar: ${count} producto${count === 1 ? '' : 's'} activo${count === 1 ? '' : 's'} ${count === 1 ? 'usa' : 'usan'} esta especie.`,
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
      return new ConflictException(`Ya existe una especie con ese ${target}`);
    }
    return error;
  }
}
