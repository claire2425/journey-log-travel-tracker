import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Journey Log · 旅行足跡",
    short_name: "Journey Log",
    description: "A private travel log for flights, rail journeys, and cruises.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f0ea",
    theme_color: "#46603c",
    categories: ["travel", "lifestyle", "utilities"],
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
