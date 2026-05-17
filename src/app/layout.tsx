import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Free Robot — Distributor Dashboard",
  description: "White-label your trading bot, manage EAs, and control user access.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} min-h-full bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
