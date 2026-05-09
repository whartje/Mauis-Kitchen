import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catSrc}
          width={24}
          height={24}
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
