import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` corta el build si un archivo de servidor llega al navegador.
      // Los tests corren en Node, así que usamos su versión vacía.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
