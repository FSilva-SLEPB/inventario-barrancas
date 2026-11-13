import type { NextConfig } from "next";

// Next inyecta scripts y estilos en línea; la política bloquea orígenes externos
// y marcos. En desarrollo se permite eval para el recargado en caliente.
const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const POLITICA_PERMISOS = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "display-capture=()",
].join(", ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['pdfkit','actas-smtp'],
  outputFileTracingIncludes: {'/exportaciones/**':['./src/app/fonts/*.otf','./public/identidad/barrancas-blanco.png'],'/insumos/**':['./src/app/fonts/*.otf','./public/identidad/barrancas-blanco.png'],'/inventario/**':['./src/app/fonts/*.otf','./public/identidad/barrancas-blanco.png']},
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: POLITICA_CONTENIDO,
          },
          {
            key: "Permissions-Policy",
            value: POLITICA_PERMISOS,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
