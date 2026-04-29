import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes glimpse installable as a Progressive Web App.
 *
 * Once installed (Add to Home Screen on mobile, Install App on desktop),
 * the app launches in standalone mode with no browser chrome — feels native.
 * Aligns with the long-term Capacitor wrap plan: the iOS/Android Capacitor
 * shell will reuse the same manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "glimpse.",
    short_name: "glimpse",
    description:
      "Match creative freelancers with startups — on style, industry, and working preferences.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1a1a",
    theme_color: "#1a1a1a",
    categories: ["lifestyle", "productivity", "social"],
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
