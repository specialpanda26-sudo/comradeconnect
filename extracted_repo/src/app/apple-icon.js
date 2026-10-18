import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          borderRadius: 40,
        }}
      >
        <svg width="110" height="110" viewBox="0 0 28 28" fill="none">
          <path
            d="M4 20 L9 8 L14 20 L19 8 L24 20"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="14" cy="4" r="2.4" fill="#dc2626" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
