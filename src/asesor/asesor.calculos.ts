export const IVA = 0.19;
export const MARGEN_OBJETIVO = 0.3;
const MAX_PRODUCTOS_MARGEN_BAJO = 5;

export interface ItemVendido {
  productoId: string;
  skuSnapshot: string;
  nombreSnapshot: string;
  precioUnitario: number;
  comisionUnitario: number;
  cantidad: number;
}

export interface ProductoMargenBajo {
  productoId: string;
  sku: string;
  nombre: string;
  margen: number;
  unidades: number;
}

export interface Desglose {
  totalVendido: number;
  reponerMercaderia: number;
  comisionTotal: number;
  ivaEstimado: number;
  gananciaReal: number;
  margenPromedio: number;
  productosMargenBajo: ProductoMargenBajo[];
}

/** IVA contenido en un monto que ya lo incluye (precio de boleta). */
export function ivaIncluido(monto: number): number {
  return Math.round((monto * IVA) / (1 + IVA));
}

/**
 * Desglose del día. Supone que la mercadería se compra con factura: el IVA de
 * la compra es crédito fiscal, así que solo se paga IVA sobre la comisión.
 */
export function calcularDesglose(
  totales: {
    totalVendido: number;
    ventaNetaTotal: number;
    ventaComisionTotal: number;
  },
  items: ItemVendido[],
): Desglose {
  const ivaEstimado = ivaIncluido(totales.ventaComisionTotal);

  return {
    totalVendido: totales.totalVendido,
    reponerMercaderia: totales.ventaNetaTotal,
    comisionTotal: totales.ventaComisionTotal,
    ivaEstimado,
    gananciaReal: totales.ventaComisionTotal - ivaEstimado,
    margenPromedio:
      totales.totalVendido > 0
        ? totales.ventaComisionTotal / totales.totalVendido
        : 0,
    productosMargenBajo: productosConMargenBajo(items),
  };
}

function productosConMargenBajo(items: ItemVendido[]): ProductoMargenBajo[] {
  const acc = new Map<
    string,
    {
      sku: string;
      nombre: string;
      venta: number;
      comision: number;
      unidades: number;
    }
  >();
  for (const item of items) {
    const entry = acc.get(item.productoId) ?? {
      sku: item.skuSnapshot,
      nombre: item.nombreSnapshot,
      venta: 0,
      comision: 0,
      unidades: 0,
    };
    entry.venta += item.precioUnitario * item.cantidad;
    entry.comision += item.comisionUnitario * item.cantidad;
    entry.unidades += item.cantidad;
    acc.set(item.productoId, entry);
  }

  return [...acc.entries()]
    .filter(([, e]) => e.venta > 0)
    .map(([productoId, e]) => ({
      productoId,
      sku: e.sku,
      nombre: e.nombre,
      margen: e.comision / e.venta,
      unidades: e.unidades,
    }))
    .filter((p) => p.margen < MARGEN_OBJETIVO)
    .sort((a, b) => a.margen - b.margen)
    .slice(0, MAX_PRODUCTOS_MARGEN_BAJO);
}
