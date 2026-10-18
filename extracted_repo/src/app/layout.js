import { Inter } from "next/font/google";
import "./globals.css";
import FloatingBrands from "@/components/FloatingBrands";
import BottomNav from "@/components/BottomNav";
import AnimatedLogo from "@/components/AnimatedLogo";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mtaavibes.com";
const DESCRIPTION =
  "Kenyan events, zero stress. Fashion shows, dressing competitions, dance events, campus nights & club events — pay with M-Pesa, get instant QR tickets.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Mtaa Vibes", template: "%s · Mtaa Vibes" },
  description: DESCRIPTION,
  applicationName: "Mtaa Vibes",
  keywords: ["Kenya events", "M-Pesa tickets", "Nairobi events", "campus events", "club nights"],
  openGraph: {
    title: "Mtaa Vibes",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Mtaa Vibes",
    locale: "en_KE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mtaa Vibes",
    description: DESCRIPTION,
  },
};

export const viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="relative min-h-screen font-sans text-ink">
        <FloatingBrands />
        <AnimatedLogo />
        <div className="relative z-10 pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
