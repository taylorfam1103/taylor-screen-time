import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taylor Screen Time Tracker",
    short_name: "Screen Time",
    description: "Family screen time, made simple.",
    start_url: "/",
    display: "standalone",
    background_color: "#071426",
    theme_color: "#071426",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
