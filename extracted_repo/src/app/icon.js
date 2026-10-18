import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Matches the mark in AnimatedLogo.jsx (chevron "M" + red dot) so the
// browser tab icon is consistent with the in-app wordmark, generated at
// build time instead of needing a designed asset checked into /public.
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <path
            d="M4 20 L9 8 L14 20 L19 8 L24 20"
            stroke="#ffffff"
            strokeWidth="3"
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
