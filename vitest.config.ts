import { defineConfig } from "vitest/config";

/** Tests unitaires de la logique pure (app/lib) : pas de serveur, pas de base, pas de Shopify. */
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
  },
});
