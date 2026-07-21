import { defineConfig } from "vitest/config";
import path from "path";

// Tests RLS/multi-tenant : integration reelle contre le projet Supabase de
// dev configure dans .env.local (voir tests/setup.ts), pas de mock ni de
// stack Supabase locale (pas de Docker dans cet environnement).
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Chaque fichier gere son propre tenant de test isole, mais tout partage
    // le meme projet Supabase distant : eviter le parallelisme entre fichiers
    // reduit le risque de rate-limit Supabase Auth sur la creation d'utilisateurs.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
