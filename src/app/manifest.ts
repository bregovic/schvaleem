import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "schvaleem",
    short_name: "schvaleem",
    description: "Schvalovací systém + API pro AX 2012",
    start_url: "/zaznamy",
    scope: "/",
    display: "standalone",
    background_color: "#0b111a",
    theme_color: "#0b111a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
