export default function manifest() {
  return {
    name: "Mtaa Vibes",
    short_name: "Mtaa Vibes",
    description:
      "Kenyan events, zero stress. Pay with M-Pesa, get instant QR tickets.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#111111",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
