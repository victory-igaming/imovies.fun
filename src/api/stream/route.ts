// app/api/stream/route.ts
// Extracts the real m3u8 stream URL from a movie embed page using Playwright.
// Also captures the full request headers (cookies, tokens) needed to proxy it.
//
// GET /api/stream?id=3293
// Returns: { streamUrl, headers, source }

import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

const SOURCES = (id: string) => [
  { title: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
  { title: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
  { title: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
  { title: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
  { title: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
];

const M3U8_RE = /\.m3u8/i;
const SKIP_RE = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking/i;
const TIMEOUT = 40_000;

async function extractStream(id: string): Promise<{
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
} | null> {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const src of SOURCES(id)) {
      const ctx  = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });
      const page = await ctx.newPage();

      let foundUrl     = "";
      let foundHeaders: Record<string, string> = {};

      page.on("request", (req) => {
        if (foundUrl) return;
        const url = req.url();
        if (SKIP_RE.test(url)) return;
        if (M3U8_RE.test(url)) {
          foundUrl     = url;
          // Capture ALL headers the browser sent — cookies, tokens, referer etc.
          foundHeaders = req.headers();
        }
      });

      try {
        await page.goto(src.url, { timeout: TIMEOUT, waitUntil: "domcontentloaded" });
        const deadline = Date.now() + TIMEOUT;
        while (Date.now() < deadline) {
          if (foundUrl) break;
          await page.waitForTimeout(500);
        }
      } catch { /* timeout — try next */ }
      finally {
        await page.close();
        await ctx.close();
      }

      if (foundUrl) {
        return { streamUrl: foundUrl, proxyHeaders: foundHeaders, source: src.title };
      }
    }
  } finally {
    await browser.close();
  }

  return null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  try {
    const result = await extractStream(id);
    if (!result) {
      return NextResponse.json({ error: "Could not find stream. All sources failed." }, { status: 404 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[stream API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}