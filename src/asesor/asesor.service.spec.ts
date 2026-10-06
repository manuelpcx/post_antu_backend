import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AsesorService } from './asesor.service';
import { ClaudeAsesorClient } from './asesor.claude';
import { PrismaService } from '../prisma/prisma.service';
import { VentasService } from '../ventas/ventas.service';

describe('AsesorService', () => {
  let service: AsesorService;
  let prisma: any;
  let ventas: { resumen: jest.Mock };
  let claude: { generarConsejo: jest.Mock };

  const consejo = {
    titulo: 'Buen día',
    consejos: [{ titulo: 'Ahorra', detalle: 'Guarda una parte.' }],
    recordatorioTributario: 'Emite boleta.',
  };

  const resumenConVentas = {
    totalVendido: 14286,
    ventaNetaTotal: 10000,
    ventaComisionTotal: 4286,
  };

  beforeEach(async () => {
    prisma = {
      ventaItem: { findMany: jest.fn().mockResolvedValue([]) },
      consejoDiario: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    ventas = { resumen: jest.fn().mockResolvedValue(resumenConVentas) };
    claude = { generarConsejo: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AsesorService,
        { provide: PrismaService, useValue: prisma },
        { provide: VentasService, useValue: ventas },
        { provide: ClaudeAsesorClient, useValue: claude },
      ],
    }).compile();

    service = module.get(AsesorService);
  });

  describe('obtener', () => {
    it('devuelve el desglose y consejo null si no se ha generado', async () => {
      const result = await service.obtener('2026-10-06');

      expect(result.desglose.gananciaReal).toBe(3602);
      expect(result.consejo).toBeNull();
      expect(result.modelo).toBeNull();
      expect(result.generadoEn).toBeNull();
      expect(prisma.ventaItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            venta: {
              createdAt: expect.any(Object),
              estado: 'COMPLETADA',
            },
          },
        }),
      );
    });

    it('incluye el consejo guardado para esa fecha', async () => {
      const generadoEn = new Date('2026-10-06T22:00:00Z');
      prisma.consejoDiario.findUnique.mockResolvedValue({
        consejo,
        modelo: 'claude-opus-5-5',
        updatedAt: generadoEn,
      });

      const result = await service.obtener('2026-10-06');

      expect(prisma.consejoDiario.findUnique).toHaveBeenCalledWith({
        where: { fecha: '2026-10-06' },
      });
      expect(result.consejo).toEqual(consejo);
      expect(result.modelo).toBe('claude-opus-5-5');
      expect(result.generadoEn).toEqual(generadoEn);
    });
  });

  describe('generar', () => {
    it('rechaza un día sin ventas sin llamar a Claude', async () => {
      ventas.resumen.mockResolvedValue({
        totalVendido: 0,
        ventaNetaTotal: 0,
        ventaComisionTotal: 0,
      });

      await expect(service.generar('2026-10-06')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(claude.generarConsejo).not.toHaveBeenCalled();
    });

    it('genera el consejo y lo guarda por fecha', async () => {
      const generadoEn = new Date('2026-10-06T23:00:00Z');
      claude.generarConsejo.mockResolvedValue({
        consejo,
        modelo: 'claude-opus-5-5',
      });
      prisma.consejoDiario.upsert.mockResolvedValue({
        consejo,
        modelo: 'claude-opus-5-5',
        updatedAt: generadoEn,
      });

      const result = await service.generar('2026-10-06');

      expect(claude.generarConsejo).toHaveBeenCalledWith(
        '2026-10-06',
        expect.objectContaining({ ivaEstimado: 684 }),
      );
      expect(prisma.consejoDiario.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fecha: '2026-10-06' },
          create: expect.objectContaining({
            fecha: '2026-10-06',
            consejo,
            modelo: 'claude-opus-5-5',
          }),
          update: expect.objectContaining({
            consejo,
            modelo: 'claude-opus-5-5',
          }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ consejo, generadoEn }));
    });
  });
});
