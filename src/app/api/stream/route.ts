// app/api/stream/route.ts

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const M3U8_RE   = /\.m3u8/i;
const M3U8_FULL = /https?:\/\/[^\s"'\\<>]+\.m3u8(?:[^\s"'\\<>]*)/gi;
const MP4_FULL  = /https?:\/\/[^\s"'\\<>]+\.(mp4|mkv|webm)(?:[^\s"'\\<>]*)/gi;
const SKIP_RE   = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha/i;
const IFRAME_RE = /<iframe[^>]+src=["']([^"']+)["']/gi;
const SCRIPT_RE = /<script[^>]+src=["']([^"']+)["']/gi;
const PW_TIMEOUT   = 15_000;
const HTTP_TIMEOUT =  7_000;
const CACHE_TTL    = 10 * 60 * 1000; // only cache successes

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreamResult {
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
  embedUrl: string;
  embedFallbacks: string[];
}

interface EmbedOnlyResult {
  streamUrl: null;
  proxyHeaders: null;
  source: null;
  embedUrl: string;
  embedFallbacks: string[];
}

type ApiResult = StreamResult | EmbedOnlyResult;
interface RawStream { streamUrl: string; proxyHeaders: Record<string, string>; source: string; }

// ── Server-side dedup + cache (successes only) ────────────────────────────────
const serverCache    = new Map<string, { data: StreamResult; expires: number }>();
const serverInflight = new Map<string, Promise<ApiResult>>();

// ── Sources ───────────────────────────────────────────────────────────────────

function buildPlaywrightSources(id: string) {
  return [
    { title: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
    { title: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
    { title: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
    { title: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
    { title: "VidSrc v2", url: `https://vidsrc.win/watch/${id}?autoPlay=true` },
  ];
}

function buildScraperSources(id: string) {
  return [
    { title: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
    { title: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
    { title: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
  ];
}

function buildEmbedFallbacks(id: string): string[] {
  return [
    `https://moviesapi.club/movie/${id}?autoplay=1`,
    `https://player.videasy.net/movie/${id}`,
    `https://vidsrc.win/watch/${id}?autoPlay=1&muted=0`,
    `https://www.vidking.net/embed/movie/${id}?autoplay=1`,
    `https://vidlink.pro/movie/${id}?autoplay=1&player=jw`,
    `https://www.nontongo.win/embed/movie/${id}?autoplay=1`,
  ];
}

function safeOrigin(url: string) {
  try { const u = new URL(url); return `${u.protocol}//${u.host}`; } catch { return ""; }
}

function makeEmbedOnly(id: string): EmbedOnlyResult {
  const embedFallbacks = buildEmbedFallbacks(id);
  return { streamUrl: null, proxyHeaders: null, source: null, embedUrl: embedFallbacks[0]!, embedFallbacks };
}

// ── Static scraper ────────────────────────────────────────────────────────────

async function fetchText(url: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Referer": referer, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });
    return res.ok ? res.text() : null;
  } catch { return null; }
}

function extractUrls(text: string): string[] {
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  M3U8_FULL.lastIndex = 0;
  while ((m = M3U8_FULL.exec(text)) !== null) {
    const u = m[0].replace(/['"\\]+$/, "");
    if (!SKIP_RE.test(u)) hits.push(u);
  }
  if (!hits.length) {
    MP4_FULL.lastIndex = 0;
    while ((m = MP4_FULL.exec(text)) !== null) {
      const u = m[0].replace(/['"\\]+$/, "");
      if (!SKIP_RE.test(u)) hits.push(u);
    }
  }
  return [...new Set(hits)];
}

async function probeUrl(rawUrl: string, referer: string): Promise<boolean> {
  let cleanUrl = rawUrl;
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete("headers");
    u.searchParams.delete("host");
    cleanUrl = u.toString();
  } catch {}
  try {
    const res = await fetch(cleanUrl, {
      method: "GET",
      headers: { "User-Agent": UA, "Referer": referer, "Origin": safeOrigin(referer), "Accept": "*/*", "Range": "bytes=0-1023" },
      signal: AbortSignal.timeout(5_000),
    });
    return res.status >= 200 && res.status < 400;
  } catch { return false; }
}

async function scrapeOne(src: { title: string; url: string }): Promise<RawStream | null> {
  const html = await fetchText(src.url, src.url);
  if (!html) return null;
  let candidates = extractUrls(html);

  if (!candidates.length) {
    const seen = new Set([src.url]);
    let m: RegExpExecArray | null;
    SCRIPT_RE.lastIndex = 0;
    const scripts: string[] = [];
    while ((m = SCRIPT_RE.exec(html)) !== null) {
      try { scripts.push(new URL(m[1]!, src.url).toString()); } catch {}
      if (scripts.length >= 6) break;
    }
    for (const s of scripts) {
      if (seen.has(s)) continue; seen.add(s);
      const js = await fetchText(s, src.url);
      if (js) { candidates = extractUrls(js); if (candidates.length) break; }
    }
  }

  if (!candidates.length) {
    let m: RegExpExecArray | null;
    IFRAME_RE.lastIndex = 0;
    while ((m = IFRAME_RE.exec(html)) !== null) {
      if (SKIP_RE.test(m[1]!)) continue;
      try {
        const abs = new URL(m[1]!, src.url).toString();
        const sub = await fetchText(abs, src.url);
        if (sub) { candidates = extractUrls(sub); if (candidates.length) break; }
      } catch {}
    }
  }

  for (const c of candidates) {
    if (await probeUrl(c, src.url)) {
      return { streamUrl: c, proxyHeaders: { "referer": src.url, "origin": safeOrigin(src.url), "user-agent": UA }, source: src.title };
    }
  }
  return null;
}

function tryScraper(id: string): Promise<RawStream | null> {
  const sources = buildScraperSources(id);
  return new Promise((resolve) => {
    let resolved = false, pending = sources.length;
    if (!pending) { resolve(null); return; }
    for (const src of sources) {
      scrapeOne(src)
        .then((r) => { pending--; if (r && !resolved) { resolved = true; resolve(r); } else if (!pending && !resolved) resolve(null); })
        .catch(() => { pending--; if (!pending && !resolved) resolve(null); });
    }
  });
}

function tryPlaywright(id: string): Promise<RawStream | null> {
  return new Promise(async (resolve) => {
    let chromium: any;
    try { ({ chromium } = await import("playwright")); }
    catch { resolve(null); return; }

    let browser: any;
    try { browser = await chromium.launch({ headless: true }); }
    catch { resolve(null); return; }

    const sources = buildPlaywrightSources(id);
    let resolved = false, pending = sources.length;

    const done = (result: RawStream | null) => {
      pending--;
      if (result && !resolved) {
        resolved = true;
        resolve(result);
        setTimeout(() => browser.close().catch(() => {}), 300);
      } else if (pending <= 0 && !resolved) {
        resolved = true;
        resolve(null);
        browser.close().catch(() => {});
      }
    };

    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(null); browser.close().catch(() => {}); }
    }, PW_TIMEOUT + 5000);

    for (const src of sources) {
      (async () => {
        let ctx: any, page: any;
        try {
          ctx  = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
          page = await ctx.newPage();
        } catch { done(null); return; }

        let found = false;
        page.on("request", (req: any) => {
          if (found || resolved) return;
          const url: string = req.url();
          if (SKIP_RE.test(url) || !M3U8_RE.test(url)) return;
          found = true;
          const headers = req.headers();
          page.close().catch(() => {});
          ctx.close().catch(() => {});
          console.log(`[stream] ✓ PW ${src.title} → ${url.slice(0, 70)}`);
          done({ streamUrl: url, proxyHeaders: headers, source: src.title });
        });

        try {
          await page.goto(src.url, { timeout: PW_TIMEOUT, waitUntil: "domcontentloaded" });
          const deadline = Date.now() + PW_TIMEOUT;
          while (Date.now() < deadline && !found && !resolved) {
            await page.waitForTimeout(300);
          }
        } catch {}

        if (!found) {
          console.log(`[stream] ✗ PW ${src.title}`);
          page.close().catch(() => {});
          ctx.close().catch(() => {});
          done(null);
        }
      })();
    }
  });
}

/**
 * Wait for the FIRST non-null result from scraper OR Playwright.
 * Unlike Promise.race(), this does NOT short-circuit on null —
 * it waits for both to finish before giving up.
 *
 * This prevents the scraper's fast null (4s) from caching a failure
 * before Playwright finds the stream (15s).
 */
function firstSuccess(...promises: Promise<RawStream | null>[]): Promise<RawStream | null> {
  return new Promise((resolve) => {
    let settled = 0;
    for (const p of promises) {
      p.then((result) => {
        if (result) { resolve(result); }  // found — resolve immediately
        else { settled++; if (settled === promises.length) resolve(null); } // all null
      }).catch(() => {
        settled++;
        if (settled === promises.length) resolve(null);
      });
    }
  });
}

async function extractForId(id: string): Promise<ApiResult> {
  const embedFallbacks = buildEmbedFallbacks(id);
  const embedUrl       = embedFallbacks[0]!;

  // Both run in parallel; return as soon as either succeeds.
  // Only fall back to embedOnly when BOTH finish with null.
  const raw = await firstSuccess(tryScraper(id), tryPlaywright(id));

  if (raw) {
    console.log(`[stream] ✓ ${raw.source} for ${id}`);
    return {
      streamUrl:    raw.streamUrl,
      proxyHeaders: raw.proxyHeaders,
      source:       raw.source,
      embedUrl,
      embedFallbacks,
    };
  }

  console.log(`[stream] ✗ all failed for ${id}`);
  return { streamUrl: null, proxyHeaders: null, source: null, embedUrl, embedFallbacks };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  // Cache hit — only cached if a stream was found (never cache failures)
  const cached = serverCache.get(id);
  if (cached && cached.expires > Date.now()) {
    console.log(`[stream] cache hit ${id}`);
    return NextResponse.json(cached.data, { status: 200, headers: { "X-Cache": "HIT" } });
  }

  // In-flight dedup — second request waits for the first
  if (serverInflight.has(id)) {
    console.log(`[stream] dedup wait ${id}`);
    const data = await serverInflight.get(id)!;
    return NextResponse.json(data, {
      status: data.streamUrl ? 200 : 404,
      headers: { "X-Cache": "WAIT" },
    });
  }

  // New extraction
  console.log(`[stream] id=${id}`);
  const promise = extractForId(id).then((data) => {
    // Only cache successes — failures should be retried
    if (data.streamUrl) {
      serverCache.set(id, { data: data as StreamResult, expires: Date.now() + CACHE_TTL });
    }
    serverInflight.delete(id);
    return data;
  }).catch((err) => {
    serverInflight.delete(id);
    console.error("[stream] fatal:", err);
    return makeEmbedOnly(id);
  });

  serverInflight.set(id, promise);

  const data = await promise;
  return NextResponse.json(data, {
    status: data.streamUrl ? 200 : 404,
    headers: { "Cache-Control": data.streamUrl ? "public, max-age=600" : "no-store" },
  });
}