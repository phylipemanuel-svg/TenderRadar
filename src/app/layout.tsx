import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const grotesk = localFont({
  src: [
    { path: "../../public/fonts/SpaceGrotesk-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/SpaceGrotesk-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/SpaceGrotesk-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flotek Tender Radar",
  description: "Internal tender intelligence for Flotek",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={grotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
