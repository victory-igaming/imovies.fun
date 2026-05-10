import type { Metadata } from "next";

import { Inter } from "next/font/google";

import "@/app/globals.css";

import MobileNav from "@/components/layout/MobileNav";

import Providers from "./providers";

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
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=pub-7209701250707799"
  crossOrigin="anonymous"
/>
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" 
    data-scroll-behavior="smooth"
    suppressHydrationWarning    
    >
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans cinematic-bg`}
      >
       <Providers> {children} </Providers>

        {/* MOBILE NAV */}
        <MobileNav />
      </body>
    </html>
  );
}