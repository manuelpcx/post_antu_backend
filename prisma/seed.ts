import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const especies = [
  { nombre: 'Perro', codigo: 'PER', color: '#F59E0B', orden: 1 },
  { nombre: 'Gato', codigo: 'GAT', color: '#8B5CF6', orden: 2 },
  { nombre: 'Otro', codigo: 'OTR', color: '#10B981', orden: 3 },
];

const categorias = [
  { nombre: 'Alimento Seco', codigo: 'SEC', descripcion: 'Alimento balanceado seco', orden: 1 },
  { nombre: 'Alimento Húmedo', codigo: 'HUM', descripcion: 'Alimento húmedo en lata o sobre', orden: 2 },
  { nombre: 'Snacks', codigo: 'SNK', descripcion: 'Premios y snacks', orden: 3 },
  { nombre: 'Accesorios', codigo: 'ACC', descripcion: 'Correas, collares, arena, juguetes', orden: 4 },
  { nombre: 'Higiene', codigo: 'HIG', descripcion: 'Shampoo y productos de aseo', orden: 5 },
  { nombre: 'Medicamentos', codigo: 'MED', descripcion: 'Antipulgas y medicamentos básicos', orden: 6 },
];

const productos = [
  // Perro
  { sku: 'PER-SEC-15K-001', nombre: 'Alimento Seco Adulto Raza Grande 15kg', especie: 'PER', categoria: 'SEC', precio: 45990, stock: 20 },
  { sku: 'PER-SEC-3K-001', nombre: 'Alimento Seco Cachorro 3kg', especie: 'PER', categoria: 'SEC', precio: 12990, stock: 30 },
  { sku: 'PER-SEC-7K-001', nombre: 'Alimento Seco Adulto Raza Mini 7kg', especie: 'PER', categoria: 'SEC', precio: 22990, stock: 25 },
  { sku: 'PER-HUM-400G-001', nombre: 'Alimento Húmedo Paté de Carne 400g', especie: 'PER', categoria: 'HUM', precio: 2990, stock: 60 },
  { sku: 'PER-HUM-400G-002', nombre: 'Alimento Húmedo Pollo y Arroz 400g', especie: 'PER', categoria: 'HUM', precio: 2990, stock: 50 },
  { sku: 'PER-SNK-001', nombre: 'Snack Dental Stick x7 un', especie: 'PER', categoria: 'SNK', precio: 5990, stock: 40 },
  { sku: 'PER-SNK-002', nombre: 'Galletas de Hígado 300g', especie: 'PER', categoria: 'SNK', precio: 3490, stock: 45 },
  { sku: 'PER-ACC-001', nombre: 'Correa Nylon 1.5m', especie: 'PER', categoria: 'ACC', precio: 7990, stock: 15 },
  { sku: 'PER-ACC-002', nombre: 'Collar Ajustable Talla M', especie: 'PER', categoria: 'ACC', precio: 5990, stock: 20 },
  { sku: 'PER-HIG-001', nombre: 'Shampoo Antipulgas 500ml', especie: 'PER', categoria: 'HIG', precio: 6990, stock: 18 },
  { sku: 'PER-MED-001', nombre: 'Antipulgas Pipeta Raza Grande', especie: 'PER', categoria: 'MED', precio: 8990, stock: 12 },
  // Gato
  { sku: 'GAT-SEC-1K5-001', nombre: 'Alimento Seco Adulto Salmón 1.5kg', especie: 'GAT', categoria: 'SEC', precio: 9990, stock: 30 },
  { sku: 'GAT-SEC-7K5-001', nombre: 'Alimento Seco Adulto Interior 7.5kg', especie: 'GAT', categoria: 'SEC', precio: 32990, stock: 15 },
  { sku: 'GAT-HUM-85G-001', nombre: 'Alimento Húmedo Atún 85g', especie: 'GAT', categoria: 'HUM', precio: 990, stock: 100 },
  { sku: 'GAT-HUM-85G-002', nombre: 'Alimento Húmedo Pollo 85g', especie: 'GAT', categoria: 'HUM', precio: 990, stock: 90 },
  { sku: 'GAT-SNK-001', nombre: 'Snack Crocante Malta 60g', especie: 'GAT', categoria: 'SNK', precio: 3990, stock: 35 },
  { sku: 'GAT-ACC-001', nombre: 'Arena Sanitaria Aglomerante 10kg', especie: 'GAT', categoria: 'ACC', precio: 9990, stock: 25 },
  { sku: 'GAT-ACC-002', nombre: 'Rascador Torre 60cm', especie: 'GAT', categoria: 'ACC', precio: 24990, stock: 8 },
  { sku: 'GAT-HIG-001', nombre: 'Shampoo Neutro para Gatos 250ml', especie: 'GAT', categoria: 'HIG', precio: 5990, stock: 15 },
  { sku: 'GAT-MED-001', nombre: 'Antipulgas Pipeta Gato', especie: 'GAT', categoria: 'MED', precio: 7990, stock: 14 },
  // Otro
  { sku: 'OTR-SEC-500G-001', nombre: 'Alimento Conejo Heno y Vegetales 500g', especie: 'OTR', categoria: 'SEC', precio: 4990, stock: 20 },
  { sku: 'OTR-SEC-500G-002', nombre: 'Alimento Hámster Mix de Semillas 500g', especie: 'OTR', categoria: 'SEC', precio: 3990, stock: 18 },
  { sku: 'OTR-SEC-250G-001', nombre: 'Alimento Canario Mix de Semillas 250g', especie: 'OTR', categoria: 'SEC', precio: 2990, stock: 22 },
  { sku: 'OTR-ACC-001', nombre: 'Bebedero para Jaula 250ml', especie: 'OTR', categoria: 'ACC', precio: 3490, stock: 3, stockMinimo: 5 },
  { sku: 'OTR-HIG-001', nombre: 'Arena Sanitaria para Roedores 4kg', especie: 'OTR', categoria: 'HIG', precio: 4990, stock: 12 },
];

async function main() {
  for (const especie of especies) {
    await prisma.especie.upsert({
      where: { codigo: especie.codigo },
      update: { nombre: especie.nombre, color: especie.color, orden: especie.orden },
      create: especie,
    });
  }

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { codigo: categoria.codigo },
      update: { nombre: categoria.nombre, descripcion: categoria.descripcion, orden: categoria.orden },
      create: categoria,
    });
  }

  const especiesMap = new Map((await prisma.especie.findMany()).map((e) => [e.codigo, e.id]));
  const categoriasMap = new Map((await prisma.categoria.findMany()).map((c) => [c.codigo, c.id]));

  for (const producto of productos) {
    const especieId = especiesMap.get(producto.especie);
    const categoriaId = categoriasMap.get(producto.categoria);
    if (!especieId || !categoriaId) {
      throw new Error(`Especie o categoría no encontrada para el producto ${producto.sku}`);
    }

    await prisma.producto.upsert({
      where: { sku: producto.sku },
      update: {
        nombre: producto.nombre,
        especieId,
        categoriaId,
        precio: producto.precio,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo ?? 5,
      },
      create: {
        sku: producto.sku,
        nombre: producto.nombre,
        especieId,
        categoriaId,
        precio: producto.precio,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo ?? 5,
      },
    });
  }

  console.log(`Seed completo: ${especies.length} especies, ${categorias.length} categorías, ${productos.length} productos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
