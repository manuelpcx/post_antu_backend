import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Productos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let especieId: string;
  let categoriaId: string;
  let productoId: string;
  let createdProductoIds: string[];

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
    createdProductoIds = [];
  });

  afterEach(async () => {
    if (createdProductoIds.length > 0) {
      await prisma.producto.deleteMany({
        where: { id: { in: createdProductoIds } },
      });
    }
    await prisma.movimientoStock.deleteMany({ where: { productoId } });
    await prisma.ventaItem.deleteMany({ where: { productoId } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.especie.deleteMany({ where: { id: especieId } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza precio enviado por el cliente en la creación (campo no reconocido)', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({
        sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: 'Producto con precio manual',
        especieId,
        categoriaId,
        valorNeto: 700,
        valorComision: 300,
        stock: 5,
        precio: 999999,
      })
      .expect(400);
  });

  it('calcula precio como valorNeto + valorComision al crear', async () => {
    const response = await request(app.getHttpServer())
      .post('/productos')
      .send({
        sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: 'Producto nuevo',
        especieId,
        categoriaId,
        valorNeto: 700,
        valorComision: 300,
        stock: 5,
      })
      .expect(201);

    expect(response.body.precio).toBe(1000);
    expect(response.body.valorNeto).toBe(700);
    expect(response.body.valorComision).toBe(300);

    createdProductoIds.push(response.body.id);
  });

  it('recalcula precio al actualizar solo valorComision, usando el valorNeto existente', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/productos/${productoId}`)
      .send({ valorComision: 400 })
      .expect(200);

    expect(response.body.precio).toBe(1100);
    expect(response.body.valorNeto).toBe(700);
    expect(response.body.valorComision).toBe(400);
  });
});
