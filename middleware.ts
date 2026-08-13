// ==========================================================
// Middleware de seguridad (BIO-SEC-010) + gating de sesión (BIO-SEC-001)
// - Cabeceras de seguridad y CSP con nonce en cada respuesta.
// - Redirige a /login si no hay cookie de sesión en rutas protegidas.
//   (La validación real de la sesión ocurre en el servidor — defensa en capas.)
// ==========================================================
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "biosteel_session";
const RUTAS_PUBLICAS = ["/login", "/api/health", "/api/notificaciones", "/cargar", "/api/cargar", "/api/flujo"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esProd = process.env.NODE_ENV === "production";

  // --- Gating de autenticación (coarse) ---
  const esPublica = RUTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const tieneSesion = request.cookies.has(SESSION_COOKIE);

  if (!esPublica && !tieneSesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Si ya autenticado, no mostrar /login
  if (pathname === "/login" && tieneSesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // --- CSP con nonce ---
  const nonce = btoa(crypto.randomUUID());
  const scriptExtra = esProd ? "" : " 'unsafe-eval'"; // HMR en desarrollo
  const connectExtra = esProd ? "" : " ws: http:";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptExtra}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org`,
    `font-src 'self'`,
    `connect-src 'self'${connectExtra}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // --- Cabeceras de seguridad ---
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (esProd) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export const config = {
  // Aplica a todo excepto estáticos de Next e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
