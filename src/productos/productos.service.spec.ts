import { Test } from '@nestjs/testing';
import { ProductosService } from './productos.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductosService', () => {
  let service: ProductosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      especie: { findUnique: jest.fn() },
      categoria: { findUnique: jest.fn() },
      producto: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ProductosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProductosService);
  });

  describe('create', () => {
    it('calcula precio como valorNeto + valorComision', async () => {
      prisma.especie.findUnique.mockResolvedValue({ id: 'esp-1', activo: true });
      prisma.categoria.findUnique.mockResolvedValue({ id: 'cat-1', activo: true });
      prisma.producto.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      const result = await service.create({
        sku: 'SKU-1',
        nombre: 'Producto 1',
        especieId: 'esp-1',
        categoriaId: 'cat-1',
        valorNeto: 700,
        valorComision: 300,
        stock: 10,
      } as any);

      expect(result.precio).toBe(1000);
      expect(prisma.producto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valorNeto: 700,
            valorComision: 300,
            precio: 1000,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('recalcula precio cuando cambia valorNeto', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'p1',
        valorNeto: 700,
        valorComision: 300,
        precio: 1000,
      });
      prisma.producto.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      const result = await service.update('p1', { valorNeto: 900 } as any);

      expect(result.precio).toBe(1200);
      expect(prisma.producto.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ valorNeto: 900, precio: 1200 }),
        }),
      );
    });

    it('no toca precio cuando no cambian valorNeto ni valorComision', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'p1',
        valorNeto: 700,
        valorComision: 300,
        precio: 1000,
      });
      prisma.producto.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      await service.update('p1', { nombre: 'Nuevo nombre' } as any);

      expect(prisma.producto.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ precio: undefined }) }),
      );
    });
  });
});
