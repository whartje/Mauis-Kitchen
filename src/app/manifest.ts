import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — tells browsers this is an installable PWA
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maui's Kitchen",
    short_name: "Maui's Kitchen",
    description:
      "Meal planning and recipe management — built around your ingredients.",
    start_url: "/",
    display: "standalone",           // hides the Safari chrome when launched from home screen
    background_color: "#18181b",     // splash screen background while app loads
    theme_color: "#f97316",          // brand orange — colors the iOS status bar
    orientation: "portrait-primary",
    icons: [
      {
        src: "/api/pwa-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
