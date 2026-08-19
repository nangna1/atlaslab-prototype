import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // public/pdf.worker.min.mjs (2026-08-19) : copie minifiee de
    // node_modules/pdfjs-dist/build/pdf.worker.min.mjs (voir
    // lib/render-document-pages.ts) - du code vendor, jamais du code source
    // de ce projet, ne doit jamais etre linte (une seule ligne minifiee de
    // ~1 Mo faisait planter eslint sur des milliers de faux positifs).
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
