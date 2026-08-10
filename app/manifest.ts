import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AtlasLab — LMS et laboratoires virtuels",
    short_name: "AtlasLab",
    description:
      "LMS et laboratoires virtuels pour l'enseignement technique et professionnel",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1512",
    theme_color: "#0e1512",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
