import { calcularDesglose, ivaIncluido, ItemVendido } from './asesor.calculos';

const item = (overrides: Partial<ItemVendido> = {}): ItemVendido => ({
  productoId: 'p1',
  skuSnapshot: 'SKU-1',
  nombreSnapshot: 'Producto 1',
  precioUnitario: 1000,
  comisionUnitario: 300,
  cantidad: 1,
  ...overrides,
});

describe('ivaIncluido', () => {
  it('calcula el IVA contenido en un monto con IVA', () => {
    expect(ivaIncluido(4286)).toBe(684);
    expect(ivaIncluido(11900)).toBe(1900);
    expect(ivaIncluido(0)).toBe(0);
  });
});

describe('calcularDesglose', () => {
  it('separa reposición, IVA y ganancia real', () => {
    const desglose = calcularDesglose(
      { totalVendido: 14286, ventaNetaTotal: 10000, ventaComisionTotal: 4286 },
      [item({ precioUnitario: 14286, comisionUnitario: 4286 })],
    );

    expect(desglose.totalVendido).toBe(14286);
    expect(desglose.reponerMercaderia).toBe(10000);
    expect(desglose.comisionTotal).toBe(4286);
    expect(desglose.ivaEstimado).toBe(684);
    expect(desglose.gananciaReal).toBe(3602);
    expect(desglose.margenPromedio).toBeCloseTo(0.3, 3);
    expect(desglose.productosMargenBajo).toEqual([]);
  });

  it('devuelve todo en cero para un día sin ventas', () => {
    const desglose = calcularDesglose(
      { totalVendido: 0, ventaNetaTotal: 0, ventaComisionTotal: 0 },
      [],
    );

    expect(desglose).toEqual({
      totalVendido: 0,
      reponerMercaderia: 0,
      comisionTotal: 0,
      ivaEstimado: 0,
      gananciaReal: 0,
      margenPromedio: 0,
      productosMargenBajo: [],
    });
  });

  it('lista productos con margen bajo el 30%, agrupados y ordenados', () => {
    const items = [
      item({
        productoId: 'a',
        nombreSnapshot: 'A',
        comisionUnitario: 200,
        cantidad: 2,
      }),
      item({
        productoId: 'a',
        nombreSnapshot: 'A',
        comisionUnitario: 200,
        cantidad: 1,
      }),
      item({ productoId: 'b', nombreSnapshot: 'B', comisionUnitario: 100 }),
      item({ productoId: 'c', nombreSnapshot: 'C', comisionUnitario: 300 }),
    ];

    const { productosMargenBajo } = calcularDesglose(
      { totalVendido: 5000, ventaNetaTotal: 3900, ventaComisionTotal: 1100 },
      items,
    );

    expect(productosMargenBajo).toEqual([
      { productoId: 'b', sku: 'SKU-1', nombre: 'B', margen: 0.1, unidades: 1 },
      { productoId: 'a', sku: 'SKU-1', nombre: 'A', margen: 0.2, unidades: 3 },
    ]);
  });

  it('muestra como máximo 5 productos con margen bajo', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item({ productoId: `p${i}`, comisionUnitario: 100 + i * 10 }),
    );

    const { productosMargenBajo } = calcularDesglose(
      { totalVendido: 7000, ventaNetaTotal: 6000, ventaComisionTotal: 1000 },
      items,
    );

    expect(productosMargenBajo).toHaveLength(5);
    expect(productosMargenBajo[0].productoId).toBe('p0');
  });
});
