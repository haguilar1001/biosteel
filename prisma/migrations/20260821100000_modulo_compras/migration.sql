-- Modulo de Compras: ordenes de compra, pendientes por despacho y facturado
-- por proveedor. Las entradas por compra (EPC) ya viven en InvMovimiento.
-- La bodega va como TEXTO sin FK: las ordenes traen bodegas que el catalogo
-- de InvBodega no tiene y con FK se perderian renglones.

CREATE TABLE "CompraOrden" (
    "id" SERIAL NOT NULL,
    "fechaOrden" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "nroOrden" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL DEFAULT '',
    "bodegaCodigo" TEXT NOT NULL DEFAULT '',
    "bodegaDesc" TEXT NOT NULL DEFAULT '',
    "referencia" TEXT NOT NULL,
    "descItem" TEXT NOT NULL DEFAULT '',
    "cantOrdenada" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorBruto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorNeto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "proveedor" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT '',
    "tipoDocto" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "marca" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "anatomia" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CompraOrden_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompraOrden_anio_mes_idx" ON "CompraOrden"("anio", "mes");
CREATE INDEX "CompraOrden_fechaOrden_idx" ON "CompraOrden"("fechaOrden");
CREATE INDEX "CompraOrden_nroOrden_idx" ON "CompraOrden"("nroOrden");
CREATE INDEX "CompraOrden_proveedor_idx" ON "CompraOrden"("proveedor");
CREATE INDEX "CompraOrden_bodegaCodigo_idx" ON "CompraOrden"("bodegaCodigo");
CREATE INDEX "CompraOrden_referencia_idx" ON "CompraOrden"("referencia");
CREATE INDEX "CompraOrden_estado_idx" ON "CompraOrden"("estado");

CREATE TABLE "CompraPendiente" (
    "id" SERIAL NOT NULL,
    "nroOrden" TEXT NOT NULL,
    "itemResumen" TEXT NOT NULL DEFAULT '',
    "cantPendiente" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorPendiente" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bodegaCodigo" TEXT NOT NULL DEFAULT '',
    "bodegaDesc" TEXT NOT NULL DEFAULT '',
    "cantOrden" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantEntrada" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "entradasRel" TEXT NOT NULL DEFAULT '',
    "fechaUltEntrada" DATE,
    "valorOrden" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "doctoReferencia" TEXT NOT NULL DEFAULT '',
    "fechaEntrega" DATE,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fechaOrden" DATE,
    "proveedor" TEXT NOT NULL DEFAULT '',
    "marca" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "anatomia" TEXT NOT NULL DEFAULT '',
    "sistema" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "cargadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraPendiente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompraPendiente_anio_mes_idx" ON "CompraPendiente"("anio", "mes");
CREATE INDEX "CompraPendiente_fechaEntrega_idx" ON "CompraPendiente"("fechaEntrega");
CREATE INDEX "CompraPendiente_nroOrden_idx" ON "CompraPendiente"("nroOrden");
CREATE INDEX "CompraPendiente_proveedor_idx" ON "CompraPendiente"("proveedor");
CREATE INDEX "CompraPendiente_bodegaCodigo_idx" ON "CompraPendiente"("bodegaCodigo");

CREATE TABLE "CompraFactura" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "co" TEXT NOT NULL DEFAULT '',
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT '',
    "doctoProveedor" TEXT NOT NULL DEFAULT '',
    "fechaDoctoProv" DATE,
    "claseDocto" TEXT NOT NULL DEFAULT '',
    "proveedor" TEXT NOT NULL DEFAULT '',
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "valorBruto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorDesctos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorImptos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorNeto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorRetenciones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorCxp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notas" TEXT NOT NULL DEFAULT '',
    "tipoDocto" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "usuarioCreacion" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CompraFactura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompraFactura_nroDocumento_key" ON "CompraFactura"("nroDocumento");
CREATE INDEX "CompraFactura_anio_mes_idx" ON "CompraFactura"("anio", "mes");
CREATE INDEX "CompraFactura_fecha_idx" ON "CompraFactura"("fecha");
CREATE INDEX "CompraFactura_proveedor_idx" ON "CompraFactura"("proveedor");
CREATE INDEX "CompraFactura_claseDocto_idx" ON "CompraFactura"("claseDocto");
CREATE INDEX "CompraFactura_estado_idx" ON "CompraFactura"("estado");

CREATE TABLE "ProveedorCompra" (
    "razonSocial" TEXT NOT NULL,
    "tipoCompra" TEXT NOT NULL DEFAULT '',
    "nit" TEXT,

    CONSTRAINT "ProveedorCompra_pkey" PRIMARY KEY ("razonSocial")
);

CREATE INDEX "ProveedorCompra_tipoCompra_idx" ON "ProveedorCompra"("tipoCompra");
