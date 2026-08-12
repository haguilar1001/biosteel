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
      bodySizeLimit: "30mb", // importador de ventas SIESA (archivos por mes/año)
    },
  },
};

export default nextConfig;
