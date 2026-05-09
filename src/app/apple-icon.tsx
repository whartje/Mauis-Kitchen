import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  // Fetch the cat PNG from the CDN — avoids fs entirely (public/ files
  // are not in the serverless function bundle on Vercel).
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mauis-kitchen.com";
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
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* objectFit:contain keeps the cat's natural aspect ratio — no stretching.
            brightness(0) collapses all colours to black, invert(1) flips to white. */}
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
