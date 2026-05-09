import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Browser favicon — auto-served at /icon.png by Next.js
export default function Icon() {
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
        <span
          style={{
            fontSize: 23,
            fontWeight: 900,
            color: "#f97316",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
          }}
        >
          M
        </span>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
