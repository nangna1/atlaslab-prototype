import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AtlasLab — LMS et laboratoires virtuels",
    short_name: "AtlasLab",
    description:
      "LMS et laboratoires virtuels pour l'enseignement technique et professionnel",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3ee",
    theme_color: "#16202c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
