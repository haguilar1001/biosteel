-- Consumo por Instalación: la bodega que despachó, deducida contra InvBodega
-- (mismo catálogo de Compras/Osteosíntesis). Entra en la llave, igual que
-- `lista`: el mismo ítem despachado de dos bodegas no se suma en una fila.
ALTER TABLE "VentaItemIps" ADD COLUMN "instalacion" INTEGER;
CREATE INDEX "VentaItemIps_instalacion_idx" ON "VentaItemIps"("instalacion");

-- Reemplaza el único índice único (sin instalacion) por uno que la incluya.
DROP INDEX IF EXISTS "VentaItemIps_anio_mes_marca_referencia_ips_lista_key";
CREATE UNIQUE INDEX "VentaItemIps_anio_mes_marca_referencia_ips_lista_instalac_key"
    ON "VentaItemIps"("anio", "mes", "marca", "referencia", "ips", "lista", "instalacion");
