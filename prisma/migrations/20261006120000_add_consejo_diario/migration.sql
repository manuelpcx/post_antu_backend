-- CreateTable
CREATE TABLE "consejos_diarios" (
    "id" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "desglose" JSONB NOT NULL,
    "consejo" JSONB NOT NULL,
    "modelo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consejos_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consejos_diarios_fecha_key" ON "consejos_diarios"("fecha");
