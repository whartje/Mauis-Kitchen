import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
