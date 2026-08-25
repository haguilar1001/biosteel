-- Moneda de la factura de la recepción (importaciones en USD/EUR/…).
ALTER TABLE "RecepcionTecnica" ADD COLUMN "monedaFactura" TEXT NOT NULL DEFAULT 'USD';
