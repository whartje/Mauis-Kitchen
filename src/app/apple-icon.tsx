import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iPhone home screen icon — auto-served at /apple-icon.png by Next.js
export default function AppleIcon() {
  // Read the cat PNG from the public folder at build/request time
  const catPng = fs.readFileSync(
    path.join(process.cwd(), "public/maui-cat.png.png")
  );
  const catSrc = `data:image/png;base64,${catPng.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #1c1c1f 0%, #27272a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Cat silhouette — same brightness(0) invert(1) treatment as the app */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catSrc}
          width={130}
          height={130}
          style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      </div>
    ),
    { width: 180, height: 180 }
  );
}
