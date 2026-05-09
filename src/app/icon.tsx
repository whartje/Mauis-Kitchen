import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const catPng = readFileSync(join(process.cwd(), "public/maui-cat.png.png"));
  const catSrc = `data:image/png;base64,${catPng.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#18181b",
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
          style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      </div>
    ),
    { width: 32, height: 32 }
  );
}
