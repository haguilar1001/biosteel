-- Puente documento de entrada -> proveedor, del reporte "entradas por compra".
-- Permite atribuir las entradas de InvMovimiento (que solo trae marca) al
-- proveedor exacto, sin duplicar el valor: ese sigue saliendo del movimiento.

CREATE TABLE "EntradaProveedor" (
    "documento" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL DEFAULT '',
    "proveedor" TEXT NOT NULL,
    "nit" TEXT,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,

    CONSTRAINT "EntradaProveedor_pkey" PRIMARY KEY ("documento")
);

CREATE INDEX "EntradaProveedor_proveedor_idx" ON "EntradaProveedor"("proveedor");
CREATE INDEX "EntradaProveedor_anio_mes_idx" ON "EntradaProveedor"("anio", "mes");
