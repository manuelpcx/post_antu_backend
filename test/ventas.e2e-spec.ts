import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Ventas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let especieId: string;
  let categoriaId: string;
  let productoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const especie = await prisma.especie.create({
      data: {
        nombre: `Especie Test ${Date.now()}`,
        codigo: `ET${Math.random().toString(36).slice(2, 6)}`,
      },
    });
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Categoria Test ${Date.now()}`,
        codigo: `CT${Math.random().toString(36).slice(2, 6)}`,
      },
    });
    const producto = await prisma.producto.create({
      data: {
        sku: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: 'Producto de prueba',
        especieId: especie.id,
        categoriaId: categoria.id,
        valorNeto: 700,
        valorComision: 300,
        precio: 1000,
        stock: 10,
      },
    });

    especieId = especie.id;
    categoriaId = categoria.id;
    productoId = producto.id;
  });

  afterEach(async () => {
    await prisma.movimientoStock.deleteMany({ where: { productoId } });
    await prisma.ventaItem.deleteMany({ where: { productoId } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.especie.deleteMany({ where: { id: especieId } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('calcula el total desde el precio en base de datos (el DTO no acepta precio/total del cliente)', async () => {
    const response = await request(app.getHttpServer())
      .post('/ventas')
      .send({
        items: [{ productoId, cantidad: 3 }],
        metodoPago: 'EFECTIVO',
      })
      .expect(201);

    expect(response.body.total).toBe(3000);
    expect(response.body.items[0].precioUnitario).toBe(1000);
    expect(response.body.items[0].subtotal).toBe(3000);
    expect(response.body.items[0].netoUnitario).toBe(700);
    expect(response.body.items[0].comisionUnitario).toBe(300);

    const producto = await prisma.producto.findUniqueOrThrow({
      where: { id: productoId },
    });
    expect(producto.stock).toBe(7);
  });

  it('rechaza campos no reconocidos como total o precio enviados por el cliente', async () => {
    await request(app.getHttpServer())
      .post('/ventas')
      .send({
        items: [{ productoId, cantidad: 1 }],
        metodoPago: 'EFECTIVO',
        total: 1,
      })
      .expect(400);

    const producto = await prisma.producto.findUniqueOrThrow({
      where: { id: productoId },
    });
    expect(producto.stock).toBe(10);
  });

  it('rechaza la venta con 400 y hace rollback completo cuando el stock es insuficiente', async () => {
    await request(app.getHttpServer())
      .post('/ventas')
      .send({ items: [{ productoId, cantidad: 999 }], metodoPago: 'EFECTIVO' })
      .expect(400);

    const producto = await prisma.producto.findUniqueOrThrow({
      where: { id: productoId },
    });
    expect(producto.stock).toBe(10);

    const ventasCreadas = await prisma.venta.count({
      where: { items: { some: { productoId } } },
    });
    expect(ventasCreadas).toBe(0);
  });

  it('anular repone el stock y no permite anular dos veces', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/ventas')
      .send({ items: [{ productoId, cantidad: 4 }], metodoPago: 'DEBITO' })
      .expect(201);

    const ventaId = createResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/ventas/${ventaId}/anular`)
      .send({})
      .expect(200);

    const producto = await prisma.producto.findUniqueOrThrow({
      where: { id: productoId },
    });
    expect(producto.stock).toBe(10);

    await request(app.getHttpServer())
      .patch(`/ventas/${ventaId}/anular`)
      .send({})
      .expect(409);
  });
});
