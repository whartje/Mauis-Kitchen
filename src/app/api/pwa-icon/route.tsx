/**
 * GET /api/pwa-icon
 *
 * Returns the 180×180 PWA home-screen icon: black background + white cat.
 * Using a plain API route instead of the app/apple-icon.tsx metadata
 * convention because Vercel's metadata-route build step fails silently
 * when the route contains an async CDN fetch (generates a 404 at runtime).
 */
import { ImageResponse } from "next/og";

// Always server-render — never statically generate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mauis-kitchen.com";

  const catData = await fetch(`${base}/maui-cat.png.png`).then((r) =>
    r.arrayBuffer()
  );
  const catSrc = `data:image/png;base64,${Buffer.from(catData).toString(
    "base64"
  )}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* brightness(0) → all pixels black, invert(1) → all pixels white */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catSrc}
          width={140}
          height={140}
          style={{
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>
    ),
    { width: 180, height: 180 }
  );
}
