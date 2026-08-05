-- Producto: valorNeto/valorComision, backfill desde precio, invariante precio = valorNeto + valorComision
ALTER TABLE "productos" ADD COLUMN "valorNeto" INTEGER;
ALTER TABLE "productos" ADD COLUMN "valorComision" INTEGER NOT NULL DEFAULT 0;

UPDATE "productos" SET "valorNeto" = "precio";

ALTER TABLE "productos" ALTER COLUMN "valorNeto" SET NOT NULL;
ALTER TABLE "productos" ADD CONSTRAINT "productos_precio_check" CHECK ("precio" = "valorNeto" + "valorComision");

-- VentaItem: netoUnitario/comisionUnitario, backfill desde precioUnitario, misma invariante
ALTER TABLE "venta_items" ADD COLUMN "netoUnitario" INTEGER;
ALTER TABLE "venta_items" ADD COLUMN "comisionUnitario" INTEGER NOT NULL DEFAULT 0;

UPDATE "venta_items" SET "netoUnitario" = "precioUnitario";

ALTER TABLE "venta_items" ALTER COLUMN "netoUnitario" SET NOT NULL;
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_precio_check" CHECK ("precioUnitario" = "netoUnitario" + "comisionUnitario");
