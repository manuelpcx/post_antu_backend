import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeAsesorClient } from './asesor.claude';
import type { Desglose } from './asesor.calculos';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    beta: { messages: { create: mockCreate } },
  })),
}));

const desglose: Desglose = {
  totalVendido: 14286,
  reponerMercaderia: 10000,
  comisionTotal: 4286,
  ivaEstimado: 684,
  gananciaReal: 3602,
  margenPromedio: 0.3,
  productosMargenBajo: [],
};

const consejoValido = {
  titulo: 'Buen día',
  consejos: [
    { titulo: 'Separa la reposición', detalle: 'Guarda $10.000.' },
    { titulo: 'Aparta el IVA', detalle: 'Guarda $684.' },
  ],
  recordatorioTributario: 'Emite boleta siempre y compra con factura.',
};

const respuesta = (overrides: Record<string, unknown> = {}) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(consejoValido) }],
  ...overrides,
});

const crearCliente = (env: Record<string, string | undefined>) =>
  new ClaudeAsesorClient({
    get: (key: string) => env[key],
  } as unknown as ConfigService);

describe('ClaudeAsesorClient', () => {
  beforeEach(() => mockCreate.mockReset());

  it('responde 503 si falta la API key, sin llamar a Claude', async () => {
    const cliente = crearCliente({});

    await expect(
      cliente.generarConsejo('2026-10-06', desglose),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('devuelve el consejo parseado y el modelo usado', async () => {
    mockCreate.mockResolvedValue(respuesta());
    const cliente = crearCliente({ ANTHROPIC_API_KEY: 'test-key' });

    const result = await cliente.generarConsejo('2026-10-06', desglose);

    expect(result).toEqual({
      consejo: consejoValido,
      modelo: 'claude-opus-5-5',
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5-5',
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: expect.objectContaining({
          effort: 'low',
          format: expect.objectContaining({ type: 'json_schema' }),
        }),
      }),
    );
  });

  it('usa el modelo configurado en ASESOR_MODEL', async () => {
    mockCreate.mockResolvedValue(respuesta({ model: 'claude-sonnet-5-5' }));
    const cliente = crearCliente({
      ANTHROPIC_API_KEY: 'test-key',
      ASESOR_MODEL: 'claude-sonnet-5-5',
    });

    await cliente.generarConsejo('2026-10-06', desglose);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5-5' }),
    );
  });

  it('responde 502 si Claude rechaza la consulta', async () => {
    mockCreate.mockResolvedValue(
      respuesta({ stop_reason: 'refusal', content: [] }),
    );
    const cliente = crearCliente({ ANTHROPIC_API_KEY: 'test-key' });

    await expect(
      cliente.generarConsejo('2026-10-06', desglose),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('responde 502 si la respuesta no es JSON válido', async () => {
    mockCreate.mockResolvedValue(
      respuesta({ content: [{ type: 'text', text: 'hola' }] }),
    );
    const cliente = crearCliente({ ANTHROPIC_API_KEY: 'test-key' });

    await expect(
      cliente.generarConsejo('2026-10-06', desglose),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('responde 502 si la API falla', async () => {
    mockCreate.mockRejectedValue(new Error('network down'));
    const cliente = crearCliente({ ANTHROPIC_API_KEY: 'test-key' });

    await expect(
      cliente.generarConsejo('2026-10-06', desglose),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
