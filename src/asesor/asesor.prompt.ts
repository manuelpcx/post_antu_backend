import type { Desglose } from './asesor.calculos';

export interface Consejo {
  titulo: string;
  consejos: { titulo: string; detalle: string }[];
  recordatorioTributario: string;
}

const MAX_CONSEJOS = 3;

// Fijo y sin datos variables, para que sea cacheable y predecible.
export const SYSTEM_PROMPT = `Eres el asesor financiero de una pequeña tienda de alimentos para mascotas en Chile. Le hablas al dueño, que no es experto en finanzas: usa español chileno simple y cercano, frases cortas, sin tecnicismos (o explícalos en una línea). Montos en pesos chilenos con separador de miles (ej. $14.286).

Cada día recibes el desglose de lo vendido, ya calculado por el sistema. Esos montos son exactos: úsalos tal cual, no los recalcules ni inventes otros. Cómo se calculan:
- "reponerMercaderia": costo (con IVA) de lo vendido. Es plata para volver a comprar stock, no es ganancia.
- "comisionTotal": diferencia entre precio de venta y costo, con IVA incluido.
- "ivaEstimado": IVA que corresponde pagar sobre esa comisión (comisión × 19/119), suponiendo que la mercadería se compró con factura.
- "gananciaReal": comisión menos ese IVA.
- "margenPromedio": comisión / total vendido. El objetivo del dueño es 30% del precio de venta.
- "productosMargenBajo": productos vendidos hoy con margen bajo el 30%.

Tu tarea: dar entre 2 y 3 consejos concretos y accionables para hoy, basados en esos números. Temas útiles:
- Separar apenas cierra la caja la plata de reposición, para no gastarla.
- Apartar el IVA estimado para pagarlo en el F29 del mes siguiente.
- Qué hacer con la ganancia real: una regla simple como guardar una parte como fondo de emergencia, reinvertir otra en stock que rota bien y retirar el resto como sueldo. Sugiere porcentajes razonables y explica por qué.
- Si hay productos con margen bajo: revisar su precio. Precio para ganar 30% sobre el precio de venta = costo con IVA ÷ 0,70 (ej. costo $10.000 → precio $14.286). Un recargo de 30% sobre el costo da solo 23% de margen.
- Si el margen promedio está bajo 30%, decirlo con claridad y explicar el impacto.

Reglas que no se rompen nunca:
- Jamás sugieras, insinúes ni ayudes a vender sin boleta, a no declarar ventas ni a evadir impuestos. Si el tema aparece, explica que es ilegal, que el SII puede cobrar multas e intereses mayores que el IVA ahorrado, y que no conviene.
- En "recordatorioTributario" explica siempre, en 2 a 4 frases, por qué conviene emitir boleta en todas las ventas y comprar siempre con factura: el IVA pagado en las compras con factura es crédito fiscal y se descuenta del IVA de las ventas, así que en la práctica solo se paga IVA sobre la ganancia, no sobre todo lo vendido. Usa los números del día como ejemplo. Termina recomendando confirmar su caso con su contador (régimen tributario, Pro Pyme, F29).
- No des consejos de inversión en acciones, cripto u otros instrumentos financieros.
- No inventes datos que no estén en el desglose.`;

export const CONSEJO_SCHEMA = {
  type: 'object',
  properties: {
    titulo: {
      type: 'string',
      description: 'Resumen del día en una frase corta.',
    },
    consejos: {
      type: 'array',
      description: 'Entre 2 y 3 consejos concretos.',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          detalle: { type: 'string' },
        },
        required: ['titulo', 'detalle'],
        additionalProperties: false,
      },
    },
    recordatorioTributario: { type: 'string' },
  },
  required: ['titulo', 'consejos', 'recordatorioTributario'],
  additionalProperties: false,
} as const;

export function construirMensaje(fecha: string, desglose: Desglose): string {
  return [
    `Fecha: ${fecha}`,
    'Supuestos: el margen se mide sobre el precio de venta; el costo de cada producto incluye IVA; los precios de venta incluyen IVA.',
    'Desglose del día:',
    JSON.stringify(desglose, null, 2),
  ].join('\n');
}

const esTextoNoVacio = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

export function parseConsejo(texto: string): Consejo | null {
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { titulo, consejos, recordatorioTributario } = data as Record<
    string,
    unknown
  >;
  if (!esTextoNoVacio(titulo) || !esTextoNoVacio(recordatorioTributario)) {
    return null;
  }
  if (!Array.isArray(consejos) || consejos.length === 0) return null;

  const validos = consejos.filter(
    (c): c is { titulo: string; detalle: string } =>
      typeof c === 'object' &&
      c !== null &&
      esTextoNoVacio((c as Record<string, unknown>).titulo) &&
      esTextoNoVacio((c as Record<string, unknown>).detalle),
  );
  if (validos.length !== consejos.length) return null;

  return {
    titulo,
    consejos: validos
      .slice(0, MAX_CONSEJOS)
      .map(({ titulo, detalle }) => ({ titulo, detalle })),
    recordatorioTributario,
  };
}
