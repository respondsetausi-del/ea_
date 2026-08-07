import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EA NAPTUNE — Distributor Dashboard",
  description: "White-label your trading bot, manage EAs, and control user access.",
};

/**
 * Next's default viewport is `width=device-width, initial-scale=1` — no zoom
 * guard. On iOS, focusing any field whose text is under 16px auto-zooms the
 * page, and it never zooms back out, so from that point the layout is wider
 * than the screen and drifts sideways for the rest of the session.
 *
 * The 16px floor in globals.css is what actually prevents the zoom; this stops
 * a pinch leaving the dashboard stuck off-centre.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
