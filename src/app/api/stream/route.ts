// app/api/stream/route.ts
// Tries Playwright first (real browser, captures exact headers).
// Falls back to static scraper if Playwright unavailable.
// Always returns embedUrl as last resort.
//
// GET /api/stream?id=3293
// Returns: { streamUrl, proxyHeaders, source, embedUrl }

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const M3U8_RE   = /\.m3u8/i;
const M3U8_FULL = /https?:\/\/[^\s"'\\<>]+\.m3u8(?:[^\s"'\\<>]*)/gi;
const MP4_FULL  = /https?:\/\/[^\s"'\\<>]+\.(mp4|mkv|webm)(?:[^\s"'\\<>]*)/gi;
const SKIP_RE   = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha/i;
const IFRAME_RE = /<iframe[^>]+src=["']([^"']+)["']/gi;
const SCRIPT_RE = /<script[^>]+src=["']([^"']+)["']/gi;
const TIMEOUT   = 40_000;

function buildSources(id: string) {
  return [
    { title: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
    { title: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
    { title: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
    { title: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
    { title: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
    { title: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
    { title: "MoviesAPI", url: `https://moviesapi.club/movie/${id}?autoplay=1` },
  ];
}

// ── Playwright path (captures real browser headers + cookies) ─────────────────
async function tryPlaywright(sources: { title: string; url: string }[]): Promise<{
  streamUrl: string; proxyHeaders: Record<string, string>; source: string;
} | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const src of sources) {
        const ctx  = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
        const page = await ctx.newPage();
        let foundUrl = "";
        let foundHeaders: Record<string, string> = {};

        page.on("request", (req) => {
          if (foundUrl) return;
          const url = req.url();
          if (SKIP_RE.test(url)) return;
          if (M3U8_RE.test(url)) {
            foundUrl     = url;
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
        } catch { /* timeout */ }
        finally { await page.close(); await ctx.close(); }

        if (foundUrl) return { streamUrl: foundUrl, proxyHeaders: foundHeaders, source: src.title };
      }
    } finally {
      await browser.close();
    }
  } catch {
    console.log("[stream] Playwright not available, falling back to scraper");
  }
  return null;
}

// ── Static scraper fallback (no browser) ─────────────────────────────────────
function extractUrls(text: string): string[] {
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  M3U8_FULL.lastIndex = 0;
  while ((m = M3U8_FULL.exec(text)) !== null) {
    const u = m[0].replace(/['"\\]+$/, "");
    if (!SKIP_RE.test(u)) hits.push(u);
  }
  if (hits.length === 0) {
    MP4_FULL.lastIndex = 0;
    while ((m = MP4_FULL.exec(text)) !== null) {
      const u = m[0].replace(/['"\\]+$/, "");
      if (!SKIP_RE.test(u)) hits.push(u);
    }
  }
  return [...new Set(hits)];
}

async function fetchText(url: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Referer": referer, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? res.text() : null;
  } catch { return null; }
}

async function scrape(url: string, referer: string, depth = 0, seen = new Set<string>()): Promise<{ streamUrl: string; referer: string } | null> {
  if (depth > 3 || seen.has(url)) return null;
  seen.add(url);
  const html = await fetchText(url, referer);
  if (!html) return null;

  const direct = extractUrls(html);
  if (direct.length) return { streamUrl: direct[0]!, referer: url };

  // Check external scripts
  const scripts: string[] = [];
  let m: RegExpExecArray | null;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html)) !== null) {
    const src = m[1]!;
    if (!SKIP_RE.test(src)) scripts.push(new URL(src, url).toString());
    if (scripts.length >= 6) break;
  }
  for (const s of scripts) {
    if (seen.has(s)) continue;
    seen.add(s);
    const js = await fetchText(s, url);
    if (js) { const hits = extractUrls(js); if (hits.length) return { streamUrl: hits[0]!, referer: url }; }
  }

  // Follow iframes
  if (depth < 2) {
    IFRAME_RE.lastIndex = 0;
    while ((m = IFRAME_RE.exec(html)) !== null) {
      const src = m[1]!;
      if (SKIP_RE.test(src)) continue;
      const result = await scrape(new URL(src, url).toString(), url, depth + 1, seen);
      if (result) return result;
    }
  }
  return null;
}

// ── API handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const sources  = buildSources(id);
  const embedUrl = sources[0]!.url; // always return first source as embed fallback

  try {
    // 1. Try Playwright (captures real headers — handles JS-rendered streams)
    const pw = await tryPlaywright(sources);
    if (pw) {
      return NextResponse.json({ ...pw, embedUrl }, {
        headers: { "Cache-Control": "public, max-age=900" },
      });
    }

    // 2. Try static scraper (fast, no browser)
    for (const src of sources) {
      const result = await scrape(src.url, src.url);
      if (result) {
        return NextResponse.json({
          streamUrl:    result.streamUrl,
          proxyHeaders: { "referer": result.referer, "origin": new URL(result.referer).origin },
          source:       src.title,
          embedUrl,
        }, { headers: { "Cache-Control": "public, max-age=900" } });
      }
    }

    // 3. Last resort: return embed URL so player shows iframe
    return NextResponse.json({ embedUrl }, { status: 404 });

  } catch (err) {
    console.error("[stream]", err);
    return NextResponse.json({ error: "Internal server error", embedUrl }, { status: 500 });
  }
}