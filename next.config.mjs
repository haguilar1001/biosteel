/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // No revelar tecnología del servidor (BIO-SEC-010)
  // Las cabeceras de seguridad principales se aplican en middleware.ts para
  // cubrir también la CSP dinámica. Aquí solo endurecemos lo estático adicional.
  experimental: {
    // Server Actions con verificación de origen (mitiga CSRF — BIO-SEC-006)
    serverActions: {
      allowedOrigins: process.env.APP_URL ? [new URL(process.env.APP_URL).host] : undefined,
      // Ventas SIESA por mes/año y balances de inventario. El archivo de
      // movimientos de inventario es mayor: ese va por npm run db:inventario-osteo.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
