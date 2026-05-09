import type { Metadata } from "next";

import { Inter } from "next/font/google";

import "@/app/globals.css";

import MobileNav from "@/components/layout/Mobilenav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "iMovies.fun",
  description:
    "Watch trending movies and TV shows online.",
};
<script
  async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=YOUR_ADSENSE_CLIENT_ID"
  crossOrigin="anonymous"
/>
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans cinematic-bg`}
      >
        {children}

        {/* MOBILE NAV */}
        <MobileNav />
      </body>
    </html>
  );
}