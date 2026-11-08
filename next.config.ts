import type { NextConfig } from "next";

// Cabeceras de seguridad. De la CSP dejamos solo las directivas que no pueden romper la conexión
// de la billetera (MetaMask, MiniPay): impiden que otro sitio meta a Pactá en un iframe
// (clickjacking sobre los botones de depositar y aprobar) y cierran formularios y bases ajenas.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Links viejos: antes las vistas eran /a/<id> (cliente) y /f/<id> (freelancer).
  // Se mantienen para que ningún link ya compartido deje de andar.
  async redirects() {
    return [
      { source: "/a/:id", destination: "/cliente/:id", permanent: true },
      { source: "/f/:id", destination: "/freelancer/:id", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
