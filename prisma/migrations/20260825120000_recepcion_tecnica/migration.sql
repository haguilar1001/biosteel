-- Recepción Técnica (FOR-ALM-005): registro + soporte PDF.

-- CreateEnum
CREATE TYPE "TipoRecepcion" AS ENUM ('importacion', 'nacional');

-- CreateEnum
CREATE TYPE "VerifDoc" AS ENUM ('si', 'no', 'na');

-- CreateEnum
CREATE TYPE "ResultadoInspeccion" AS ENUM ('conforme', 'no_conforme', 'cuarentena');

-- CreateTable
CREATE TABLE "RecepcionTecnica" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoRecepcion" NOT NULL,
    "consecutivo" TEXT NOT NULL,
    "fechaInspeccion" DATE NOT NULL,
    "horaRecepcion" TEXT NOT NULL DEFAULT '',
    "odcPedido" TEXT NOT NULL DEFAULT '',
    "proveedorNombre" TEXT NOT NULL DEFAULT '',
    "registroInvima" TEXT NOT NULL DEFAULT '',
    "facturaRemision" TEXT NOT NULL DEFAULT '',
    "valorFactura" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "guiaTransporte" TEXT NOT NULL DEFAULT '',
    "transportador" TEXT NOT NULL DEFAULT '',
    "loteDespacho" TEXT NOT NULL DEFAULT '',
    "fechaCaducidad" DATE,
    "cantOdc" INTEGER,
    "docFacturaComercial" "VerifDoc" NOT NULL DEFAULT 'na',
    "docPackingList" "VerifDoc" NOT NULL DEFAULT 'na',
    "docImportacion" "VerifDoc" NOT NULL DEFAULT 'na',
    "docRsInvima" "VerifDoc" NOT NULL DEFAULT 'na',
    "docCertCalidad" "VerifDoc" NOT NULL DEFAULT 'na',
    "docInstruccionesEsp" "VerifDoc" NOT NULL DEFAULT 'na',
    "docCertEsterilidad" "VerifDoc" NOT NULL DEFAULT 'na',
    "transSinDanos" BOOLEAN NOT NULL DEFAULT false,
    "transConDanos" BOOLEAN NOT NULL DEFAULT false,
    "transSelloViolado" BOOLEAN NOT NULL DEFAULT false,
    "transTempAdecuada" BOOLEAN NOT NULL DEFAULT false,
    "transTempNoAdecuada" BOOLEAN NOT NULL DEFAULT false,
    "transObservacion" TEXT NOT NULL DEFAULT '',
    "resultado" TEXT NOT NULL DEFAULT '',
    "areaDestino" TEXT NOT NULL DEFAULT '',
    "decision" TEXT NOT NULL DEFAULT '',
    "accionTomar" TEXT NOT NULL DEFAULT '',
    "validacionFactura" TEXT NOT NULL DEFAULT '',
    "recibidoPor" TEXT NOT NULL DEFAULT '',
    "revisadoPor" TEXT NOT NULL DEFAULT '',
    "aprobadoPor" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecepcionTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionItem" (
    "id" SERIAL NOT NULL,
    "recepcionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "codigo" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL DEFAULT '',
    "especificacion" TEXT NOT NULL DEFAULT '',
    "cantPedida" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantRecibida" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lote" TEXT NOT NULL DEFAULT '',
    "fechaCaducidad" DATE,
    "observaciones" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RecepcionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionCriterio" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "criterio" TEXT NOT NULL,
    "resultado" "ResultadoInspeccion" NOT NULL DEFAULT 'conforme',

    CONSTRAINT "RecepcionCriterio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecepcionTecnica_consecutivo_key" ON "RecepcionTecnica"("consecutivo");
CREATE INDEX "RecepcionTecnica_tipo_idx" ON "RecepcionTecnica"("tipo");
CREATE INDEX "RecepcionTecnica_fechaInspeccion_idx" ON "RecepcionTecnica"("fechaInspeccion");
CREATE INDEX "RecepcionItem_recepcionId_idx" ON "RecepcionItem"("recepcionId");
CREATE INDEX "RecepcionCriterio_itemId_idx" ON "RecepcionCriterio"("itemId");

-- AddForeignKey
ALTER TABLE "RecepcionItem" ADD CONSTRAINT "RecepcionItem_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "RecepcionTecnica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecepcionCriterio" ADD CONSTRAINT "RecepcionCriterio_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RecepcionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
