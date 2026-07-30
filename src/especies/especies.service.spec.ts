import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EspeciesService } from './especies.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EspeciesService', () => {
  let service: EspeciesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      especie: { findUnique: jest.fn(), update: jest.fn() },
      producto: { count: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        EspeciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EspeciesService);
  });

  describe('update (desactivar vía activo: false)', () => {
    it('responde 409 y no actualiza cuando hay productos activos asociados', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: true });
      prisma.producto.count.mockResolvedValue(3);

      await expect(
        service.update('e1', { activo: false }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.especie.update).not.toHaveBeenCalled();
    });

    it('incluye la cantidad de productos afectados en el mensaje de error', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: true });
      prisma.producto.count.mockResolvedValue(3);

      await expect(service.update('e1', { activo: false })).rejects.toThrow(
        '3 productos',
      );
    });

    it('permite desactivar cuando no hay productos activos asociados', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: true });
      prisma.producto.count.mockResolvedValue(0);
      prisma.especie.update.mockResolvedValue({ id: 'e1', activo: false });

      const result = await service.update('e1', { activo: false });
      expect(result.activo).toBe(false);
    });

    it('no valida productos activos si la especie ya estaba inactiva', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: false });
      prisma.especie.update.mockResolvedValue({
        id: 'e1',
        activo: false,
        nombre: 'Nuevo nombre',
      });

      await service.update('e1', { nombre: 'Nuevo nombre' });
      expect(prisma.producto.count).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('responde 409 cuando hay productos activos asociados', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: true });
      prisma.producto.count.mockResolvedValue(2);

      await expect(service.softDelete('e1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('desactiva cuando no hay productos activos asociados', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'e1', activo: true });
      prisma.producto.count.mockResolvedValue(0);
      prisma.especie.update.mockResolvedValue({ id: 'e1', activo: false });

      const result = await service.softDelete('e1');
      expect(result.activo).toBe(false);
    });
  });
});
