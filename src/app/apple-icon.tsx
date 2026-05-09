import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // public/maui-cat.png.png is bundled into this route via
  // outputFileTracingIncludes in next.config.ts
  const catPng = readFileSync(join(process.cwd(), "public/maui-cat.png.png"));
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
