import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VentasService', () => {
  let service: VentasService;
  let tx: any;
  let prisma: any;

  const producto = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-1',
    sku: 'SKU-1',
    nombre: 'Producto 1',
    especieId: 'esp-1',
    categoriaId: 'cat-1',
    precio: 1000,
    valorNeto: 700,
    valorComision: 300,
    stock: 10,
    activo: true,
    especie: { nombre: 'Perro' },
    categoria: { nombre: 'Alimento' },
    ...overrides,
  });

  beforeEach(async () => {
    tx = {
      producto: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      venta: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      movimientoStock: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
      venta: { findMany: jest.fn() },
      especie: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [VentasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(VentasService);
  });

  describe('crear', () => {
    it('calcula el total sumando precio × cantidad de cada ítem, y snapshotea neto/comisión', async () => {
      const p1 = producto({ id: 'p1', precio: 1000, valorNeto: 700, valorComision: 300 });
      const p2 = producto({ id: 'p2', precio: 2500, valorNeto: 2000, valorComision: 500 });
      tx.producto.findMany.mockResolvedValue([p1, p2]);
      tx.venta.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'venta-1',
          total: data.total,
          metodoPago: data.metodoPago,
          items: data.items.create.map((item: any, idx: number) => ({
            id: `item-${idx}`,
            ventaId: 'venta-1',
            ...item,
          })),
        }),
      );
      tx.producto.updateMany.mockResolvedValue({ count: 1 });
      tx.producto.findUniqueOrThrow.mockImplementation(({ where }: any) =>
        Promise.resolve({ ...(where.id === 'p1' ? p1 : p2), stock: 5 }),
      );

      const result = await service.crear({
        items: [
          { productoId: 'p1', cantidad: 2 },
          { productoId: 'p2', cantidad: 1 },
        ],
        metodoPago: 'EFECTIVO',
      } as any);

      expect(result.total).toBe(1000 * 2 + 2500 * 1);
      expect(tx.movimientoStock.create).toHaveBeenCalledTimes(2);
      expect(result.items[0].netoUnitario).toBe(700);
      expect(result.items[0].comisionUnitario).toBe(300);
      expect(result.items[1].netoUnitario).toBe(2000);
      expect(result.items[1].comisionUnitario).toBe(500);
    });

    it('rechaza con BadRequestException cuando el stock es insuficiente, sin registrar movimientos', async () => {
      const p1 = producto({ id: 'p1', precio: 1000, stock: 1 });
      tx.producto.findMany.mockResolvedValue([p1]);
      tx.venta.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'venta-1',
          total: data.total,
          items: data.items.create.map((item: any, idx: number) => ({
            id: `item-${idx}`,
            ...item,
          })),
        }),
      );
      tx.producto.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.crear({
          items: [{ productoId: 'p1', cantidad: 5 }],
          metodoPago: 'EFECTIVO',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.movimientoStock.create).not.toHaveBeenCalled();
    });

    it('propaga el error dentro de $transaction para que Prisma revierta todo (rollback)', async () => {
      tx.producto.findMany.mockResolvedValue([]);

      await expect(
        service.crear({
          items: [{ productoId: 'inexistente', cantidad: 1 }],
          metodoPago: 'EFECTIVO',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rechaza vender un producto inactivo', async () => {
      const inactivo = producto({ id: 'p1', activo: false });
      tx.producto.findMany.mockResolvedValue([inactivo]);

      await expect(
        service.crear({
          items: [{ productoId: 'p1', cantidad: 1 }],
          metodoPago: 'EFECTIVO',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resumen', () => {
    it('suma ventaNetaTotal y ventaComisionTotal desde los snapshots de cada item', async () => {
      prisma.venta.findMany.mockResolvedValue([
        {
          id: 'v1',
          total: 3000,
          metodoPago: 'EFECTIVO',
          items: [
            {
              especieId: 'esp-1',
              productoId: 'p1',
              skuSnapshot: 'SKU-1',
              nombreSnapshot: 'Producto 1',
              precioUnitario: 1000,
              netoUnitario: 700,
              comisionUnitario: 300,
              cantidad: 2,
              subtotal: 2000,
            },
            {
              especieId: 'esp-1',
              productoId: 'p2',
              skuSnapshot: 'SKU-2',
              nombreSnapshot: 'Producto 2',
              precioUnitario: 1000,
              netoUnitario: 800,
              comisionUnitario: 200,
              cantidad: 1,
              subtotal: 1000,
            },
          ],
        },
      ]);
      prisma.especie.findMany.mockResolvedValue([
        { id: 'esp-1', nombre: 'Perro', color: '#fff' },
      ]);

      const result = await service.resumen('2026-08-05');

      expect(result.ventaNetaTotal).toBe(700 * 2 + 800 * 1);
      expect(result.ventaComisionTotal).toBe(300 * 2 + 200 * 1);
    });
  });

  describe('anular', () => {
    it('lanza ConflictException si la venta ya está anulada', async () => {
      tx.venta.findUnique.mockResolvedValue({
        id: 'v1',
        estado: 'ANULADA',
        items: [],
      });

      await expect(service.anular('v1', {})).rejects.toThrow('ya está anulada');
    });
  });
});
