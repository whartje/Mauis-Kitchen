import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iPhone home screen icon — auto-served at /apple-icon.png by Next.js
// iOS uses this when a user taps "Add to Home Screen" in Safari
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #1c1c1f 0%, #27272a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {/* Large "M" in brand orange */}
        <span
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: "#f97316",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            letterSpacing: -3,
          }}
        >
          M
        </span>
        {/* Subtle "kitchen" wordmark beneath */}
        <span
          style={{
            fontSize: 17,
            color: "#71717a",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          kitchen
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
