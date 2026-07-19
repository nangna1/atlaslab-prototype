import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse -> pdfjs-dist charge @napi-rs/canvas (binaire natif specifique
  // a la plateforme) de facon dynamique -- le bundler Next.js ne le detecte
  // pas correctement, ce qui casse l'extraction PDF en production (Vercel).
  // On force ces paquets en require() natif Node plutot qu'en bundle.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
