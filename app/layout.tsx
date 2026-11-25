import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.product} – ${BRAND.tagline}`,
  description: "שולחים צ'אט מוואטסאפ, עונים על 8 שאלות, ומקבלים קבלה מפורטת: מי כותב, מי עונה, מי שותק, ומה השורה התחתונה.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#232321" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
