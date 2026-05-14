/**
 * GET /api/favicon
 *
 * Returns the 32×32 browser tab favicon: orange background + white cat.
 * Using a plain API route because Vercel's metadata-route build step
 * (icon.tsx) fails silently with dynamic images, generating a 404 at runtime.
 */
import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mauis-kitchen.com";

  const catData = await fetch(`${base}/maui-cat.png.png`).then((r) =>
    r.arrayBuffer()
  );
  const catSrc = `data:image/png;base64,${Buffer.from(catData).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f97316",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catSrc}
          width={22}
          height={22}
          style={{
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>
    ),
    { width: 32, height: 32 }
  );
}
