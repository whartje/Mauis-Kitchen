import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const catPath = path.join(process.cwd(), "public", "maui-cat.png.png");
  const catData = fs.readFileSync(catPath);
  const catSrc = `data:image/png;base64,${catData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f97316",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catSrc}
          width={136}
          height={136}
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
