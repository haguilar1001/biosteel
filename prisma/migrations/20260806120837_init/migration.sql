-- CreateEnum
CREATE TYPE "TipoSede" AS ENUM ('administrativa', 'bodega');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('natural', 'juridica');

-- CreateEnum
CREATE TYPE "CategoriaCliente" AS ENUM ('clinica_ips', 'eps_aseguradora', 'distribuidor', 'cirujano_particular');

-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('nacional', 'importado');

-- CreateEnum
CREATE TYPE "OrigenFactura" AS ENUM ('directa', 'consignacion');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('corriente', 'abonada_parcial', 'en_mora', 'vencida', 'en_glosa', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('vigente', 'proximo_vencer', 'vencido', 'pagado_parcial', 'pagado');

-- CreateEnum
CREATE TYPE "EstadoGlosa" AS ENUM ('abierta', 'en_conciliacion', 'conciliada', 'aceptada');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('credito', 'debito');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('transferencia', 'cheque', 'efectivo', 'consignacion');

-- CreateEnum
CREATE TYPE "TipoRetencion" AS ENUM ('retefuente', 'reteiva', 'reteica');

-- CreateEnum
CREATE TYPE "AlcancePermiso" AS ENUM ('todos', 'propio', 'ninguno');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sede" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoSede" NOT NULL,
    "ciudad" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "id" SERIAL NOT NULL,
    "banco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "sedeId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moneda" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "TasaCambio" (
    "id" SERIAL NOT NULL,
    "monedaCodigo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valorCop" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "TasaCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoRetencion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoRetencion" NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConceptoRetencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rolId" INTEGER NOT NULL,
    "sedeId" INTEGER,
    "dobleFactor" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "id" SERIAL NOT NULL,
    "rolId" INTEGER NOT NULL,
    "permisoId" INTEGER NOT NULL,
    "alcance" "AlcancePermiso" NOT NULL DEFAULT 'ninguno',

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tercero" (
    "id" SERIAL NOT NULL,
    "nit" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoPersona" "TipoPersona" NOT NULL DEFAULT 'juridica',
    "ciudad" TEXT,
    "esCliente" BOOLEAN NOT NULL DEFAULT false,
    "esProveedor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientePerfil" (
    "terceroId" INTEGER NOT NULL,
    "categoria" "CategoriaCliente" NOT NULL,
    "vendedorId" INTEGER,
    "cupoCredito" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "diasCredito" INTEGER NOT NULL DEFAULT 30,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientePerfil_pkey" PRIMARY KEY ("terceroId")
);

-- CreateTable
CREATE TABLE "ProveedorPerfil" (
    "terceroId" INTEGER NOT NULL,
    "tipo" "TipoProveedor" NOT NULL DEFAULT 'nacional',
    "monedaDefault" TEXT NOT NULL DEFAULT 'COP',
    "diasCredito" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "ProveedorPerfil_pkey" PRIMARY KEY ("terceroId")
);

-- CreateTable
CREATE TABLE "Vendedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" SERIAL NOT NULL,
    "terceroId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "cargo" TEXT,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaVenta" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "terceroId" INTEGER NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "vendedorId" INTEGER,
    "origen" "OrigenFactura" NOT NULL DEFAULT 'directa',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "valorTotal" DECIMAL(18,2) NOT NULL,
    "iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'corriente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCd" (
    "id" SERIAL NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "tipo" "TipoNota" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Glosa" (
    "id" SERIAL NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoGlosa" NOT NULL DEFAULT 'abierta',
    "descripcion" TEXT,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Glosa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recaudo" (
    "id" SERIAL NOT NULL,
    "terceroId" INTEGER NOT NULL,
    "cuentaId" INTEGER,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medio" "MedioPago" NOT NULL,
    "valorRecibido" DECIMAL(18,2) NOT NULL,
    "totalRetenciones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "referencia" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recaudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecaudoAplicacion" (
    "id" SERIAL NOT NULL,
    "recaudoId" INTEGER NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "valorAplicado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "RecaudoAplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecaudoRetencion" (
    "id" SERIAL NOT NULL,
    "recaudoId" INTEGER NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "base" DECIMAL(18,2) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "RecaudoRetencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anticipo" (
    "id" SERIAL NOT NULL,
    "terceroId" INTEGER NOT NULL,
    "recaudoId" INTEGER,
    "saldo" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anticipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoCxp" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "valorOrigen" DECIMAL(18,2) NOT NULL,
    "trmCausacion" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "valorCop" DECIMAL(18,2) NOT NULL,
    "saldo" DECIMAL(18,2) NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "tipo" "TipoProveedor" NOT NULL DEFAULT 'nacional',
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'vigente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoCxp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoImportacion" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CostoImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "cuentaId" INTEGER,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "trmPago" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "valorOrigen" DECIMAL(18,2) NOT NULL,
    "valorCop" DECIMAL(18,2) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoAplicacion" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "valorAplicado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PagoAplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiferenciaCambio" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DiferenciaCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nit_key" ON "Empresa"("nit");

-- CreateIndex
CREATE INDEX "Sede_empresaId_idx" ON "Sede"("empresaId");

-- CreateIndex
CREATE INDEX "CuentaBancaria_sedeId_idx" ON "CuentaBancaria"("sedeId");

-- CreateIndex
CREATE INDEX "TasaCambio_fecha_idx" ON "TasaCambio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "TasaCambio_monedaCodigo_fecha_key" ON "TasaCambio"("monedaCodigo", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rolId_idx" ON "Usuario"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_clave_key" ON "Permiso"("clave");

-- CreateIndex
CREATE INDEX "RolPermiso_rolId_idx" ON "RolPermiso"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "RolPermiso_rolId_permisoId_key" ON "RolPermiso"("rolId", "permisoId");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE INDEX "Sesion_expiresAt_idx" ON "Sesion"("expiresAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidad_entidadId_idx" ON "LogAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "LogAuditoria_createdAt_idx" ON "LogAuditoria"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tercero_nit_key" ON "Tercero"("nit");

-- CreateIndex
CREATE INDEX "Tercero_nombre_idx" ON "Tercero"("nombre");

-- CreateIndex
CREATE INDEX "ClientePerfil_vendedorId_idx" ON "ClientePerfil"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendedor_usuarioId_key" ON "Vendedor"("usuarioId");

-- CreateIndex
CREATE INDEX "Contacto_terceroId_idx" ON "Contacto"("terceroId");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaVenta_numero_key" ON "FacturaVenta"("numero");

-- CreateIndex
CREATE INDEX "FacturaVenta_terceroId_idx" ON "FacturaVenta"("terceroId");

-- CreateIndex
CREATE INDEX "FacturaVenta_sedeId_idx" ON "FacturaVenta"("sedeId");

-- CreateIndex
CREATE INDEX "FacturaVenta_vendedorId_idx" ON "FacturaVenta"("vendedorId");

-- CreateIndex
CREATE INDEX "FacturaVenta_estado_idx" ON "FacturaVenta"("estado");

-- CreateIndex
CREATE INDEX "FacturaVenta_fechaVencimiento_idx" ON "FacturaVenta"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "NotaCd_facturaId_idx" ON "NotaCd"("facturaId");

-- CreateIndex
CREATE INDEX "Glosa_facturaId_idx" ON "Glosa"("facturaId");

-- CreateIndex
CREATE INDEX "Glosa_estado_idx" ON "Glosa"("estado");

-- CreateIndex
CREATE INDEX "Recaudo_terceroId_idx" ON "Recaudo"("terceroId");

-- CreateIndex
CREATE INDEX "Recaudo_fecha_idx" ON "Recaudo"("fecha");

-- CreateIndex
CREATE INDEX "RecaudoAplicacion_recaudoId_idx" ON "RecaudoAplicacion"("recaudoId");

-- CreateIndex
CREATE INDEX "RecaudoAplicacion_facturaId_idx" ON "RecaudoAplicacion"("facturaId");

-- CreateIndex
CREATE INDEX "RecaudoRetencion_recaudoId_idx" ON "RecaudoRetencion"("recaudoId");

-- CreateIndex
CREATE UNIQUE INDEX "Anticipo_recaudoId_key" ON "Anticipo"("recaudoId");

-- CreateIndex
CREATE INDEX "Anticipo_terceroId_idx" ON "Anticipo"("terceroId");

-- CreateIndex
CREATE INDEX "DocumentoCxp_proveedorId_idx" ON "DocumentoCxp"("proveedorId");

-- CreateIndex
CREATE INDEX "DocumentoCxp_estado_idx" ON "DocumentoCxp"("estado");

-- CreateIndex
CREATE INDEX "DocumentoCxp_fechaVencimiento_idx" ON "DocumentoCxp"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoCxp_numero_proveedorId_key" ON "DocumentoCxp"("numero", "proveedorId");

-- CreateIndex
CREATE INDEX "CostoImportacion_documentoId_idx" ON "CostoImportacion"("documentoId");

-- CreateIndex
CREATE INDEX "Pago_proveedorId_idx" ON "Pago"("proveedorId");

-- CreateIndex
CREATE INDEX "Pago_fecha_idx" ON "Pago"("fecha");

-- CreateIndex
CREATE INDEX "PagoAplicacion_pagoId_idx" ON "PagoAplicacion"("pagoId");

-- CreateIndex
CREATE INDEX "PagoAplicacion_documentoId_idx" ON "PagoAplicacion"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "DiferenciaCambio_pagoId_key" ON "DiferenciaCambio"("pagoId");

-- AddForeignKey
ALTER TABLE "Sede" ADD CONSTRAINT "Sede_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasaCambio" ADD CONSTRAINT "TasaCambio_monedaCodigo_fkey" FOREIGN KEY ("monedaCodigo") REFERENCES "Moneda"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePerfil" ADD CONSTRAINT "ClientePerfil_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePerfil" ADD CONSTRAINT "ClientePerfil_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorPerfil" ADD CONSTRAINT "ProveedorPerfil_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendedor" ADD CONSTRAINT "Vendedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCd" ADD CONSTRAINT "NotaCd_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Glosa" ADD CONSTRAINT "Glosa_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recaudo" ADD CONSTRAINT "Recaudo_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recaudo" ADD CONSTRAINT "Recaudo_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recaudo" ADD CONSTRAINT "Recaudo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecaudoAplicacion" ADD CONSTRAINT "RecaudoAplicacion_recaudoId_fkey" FOREIGN KEY ("recaudoId") REFERENCES "Recaudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecaudoAplicacion" ADD CONSTRAINT "RecaudoAplicacion_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecaudoRetencion" ADD CONSTRAINT "RecaudoRetencion_recaudoId_fkey" FOREIGN KEY ("recaudoId") REFERENCES "Recaudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecaudoRetencion" ADD CONSTRAINT "RecaudoRetencion_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoRetencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_recaudoId_fkey" FOREIGN KEY ("recaudoId") REFERENCES "Recaudo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoCxp" ADD CONSTRAINT "DocumentoCxp_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Tercero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostoImportacion" ADD CONSTRAINT "CostoImportacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoCxp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Tercero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoCxp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiferenciaCambio" ADD CONSTRAINT "DiferenciaCambio_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
