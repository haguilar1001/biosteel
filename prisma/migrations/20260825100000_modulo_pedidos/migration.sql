-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL DEFAULT '',
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT '',
    "bodegaCodigo" TEXT NOT NULL DEFAULT '',
    "bodegaDesc" TEXT NOT NULL DEFAULT '',
    "instalacion" INTEGER,
    "instalacionDesc" TEXT NOT NULL DEFAULT '',
    "referencia" TEXT NOT NULL,
    "descItem" TEXT NOT NULL DEFAULT '',
    "cantPedida" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantExist" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoProm" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "precioUnit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorBruto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "utilidad" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "marca" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "anatomia" TEXT NOT NULL DEFAULT '',
    "sistema" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "procedimiento" TEXT NOT NULL DEFAULT '',
    "paciente" TEXT NOT NULL DEFAULT '',
    "medico" TEXT NOT NULL DEFAULT '',
    "fechaCx" DATE,
    "cliente" TEXT NOT NULL DEFAULT '',
    "lista" TEXT NOT NULL DEFAULT '',
    "listaDesc" TEXT NOT NULL DEFAULT '',
    "tipoCliente" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "condicionPago" TEXT NOT NULL DEFAULT '',
    "proveedor" TEXT NOT NULL DEFAULT '',
    "nitProveedor" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pedido_anio_mes_idx" ON "Pedido"("anio", "mes");

-- CreateIndex
CREATE INDEX "Pedido_fecha_idx" ON "Pedido"("fecha");

-- CreateIndex
CREATE INDEX "Pedido_nroDocumento_idx" ON "Pedido"("nroDocumento");

-- CreateIndex
CREATE INDEX "Pedido_referencia_idx" ON "Pedido"("referencia");

-- CreateIndex
CREATE INDEX "Pedido_marca_idx" ON "Pedido"("marca");

-- CreateIndex
CREATE INDEX "Pedido_proveedor_idx" ON "Pedido"("proveedor");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_ciudad_idx" ON "Pedido"("ciudad");

-- CreateIndex
CREATE INDEX "Pedido_bodegaCodigo_idx" ON "Pedido"("bodegaCodigo");

-- CreateIndex
CREATE INDEX "Pedido_linea_idx" ON "Pedido"("linea");

