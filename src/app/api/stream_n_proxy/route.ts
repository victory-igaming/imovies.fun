// src/app/api/stream/route.ts
//
// Stealth Playwright extraction — bypasses Cloudflare bot detection on VPS.
// GET /api/stream?id=<tmdb_id>&bust=1

import { NextRequest, NextResponse } from "next/server";
import { chromium, type BrowserContext, type Page } from "playwright";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SOURCES = (id: string) => [
  { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
  { name: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
  // Videasy handled via direct API (extractVideasy) — headless Playwright always gets empty shell
  { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
  { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
  { name: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
  { name: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
];

const EMBEDS = (id: string) => [
  { name: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
  { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
  { name: "VidSrc V3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
  { name: "VidSrc V2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
  { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
  { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
  { name: "MoviesAPI", url: `https://moviesapi.club/movie/${id}?autoplay=1` },
  { name: "2Embed",    url: `https://2embed.org/embed/movie/tmdb/${id}` },
];

// Match media extensions only in the URL path (before any ?), not query strings.
// This prevents analytics beacons like ping.gif?e=mp4... from matching.
function isMediaUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(m3u8|mp4|mkv|webm|ts)$/.test(path);
  } catch {
    // Fallback for malformed URLs — check before the first ?
    const path = url.split("?")[0]!.toLowerCase();
    return /\.(m3u8|mp4|mkv|webm|ts)$/.test(path);
  }
}

// Domains/patterns to always skip — analytics, ads, trackers, CDN ping beacons
const SKIP_RE = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha|googlevideo\.com|jwpltx\.com|jwpsrv\.com|jwplatform\.com\/ping|imasdk\.googleapis/i;
const BLOCKED_CDN_HOSTS = ["stormvv.vodvidl.site", "vodvidl.site", "hakunaymatata.com"];

function isBlockedCdn(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_CDN_HOSTS.some((b) => host === b || host.endsWith("." + b));
  } catch { return false; }
}

const CACHE     = new Map<string, { data: StreamApiResponse; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// ── FIX 1: In-flight deduplication ───────────────────────────────────────────
// Prevents two simultaneous requests for the same ID (e.g. React StrictMode
// double-invoke, or two browser tabs) from each spinning up a full Playwright
// session. The second caller just awaits the same promise.
const IN_FLIGHT = new Map<string, Promise<StreamApiResponse>>();

export interface StreamApiResponse {
  streamUrl:    string | null;
  proxyHeaders: Record<string, string> | null;
  source:       string | null;
  embedSources: Array<{ name: string; url: string }>;
  embedUrl:     string;
}

// ── Stealth init script — patches every fingerprint Cloudflare checks ─────────
const STEALTH_SCRIPT = `
(() => {
  // 1. Remove automation flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  delete navigator.__proto__.webdriver;

  // 2. Realistic plugins
  const makePlugin = (name, filename, desc, mimeTypes) => {
    const plugin = Object.create(Plugin.prototype);
    Object.defineProperties(plugin, {
      name:        { value: name, enumerable: true },
      filename:    { value: filename, enumerable: true },
      description: { value: desc, enumerable: true },
      length:      { value: mimeTypes.length },
    });
    mimeTypes.forEach((mt, i) => { plugin[i] = mt; });
    return plugin;
  };
  const pluginArr = [
    makePlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format', []),
    makePlugin('Chrome PDF Viewer', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', '', []),
    makePlugin('Chromium PDF Viewer', 'internal-pdf-viewer', '', []),
    makePlugin('Microsoft Edge PDF Viewer', 'internal-pdf-viewer', '', []),
    makePlugin('WebKit built-in PDF', 'internal-pdf-viewer', '', []),
  ];
  Object.defineProperty(navigator, 'plugins', {
    get: () => { const arr = [...pluginArr]; arr.item = i => arr[i]; arr.namedItem = n => arr.find(p => p.name===n)||null; arr.refresh = ()=>{}; Object.setPrototypeOf(arr, PluginArray.prototype); return arr; }
  });

  // 3. Languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // 4. Screen
  Object.defineProperty(screen, 'width',       { get: () => 1920 });
  Object.defineProperty(screen, 'height',      { get: () => 1080 });
  Object.defineProperty(screen, 'availWidth',  { get: () => 1920 });
  Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
  Object.defineProperty(screen, 'colorDepth',  { get: () => 24 });

  // 5. Hardware
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory',        { get: () => 8 });

  // 6. Chrome object
  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {};

  // 7. Permissions
  const origQuery = navigator.permissions?.query?.bind(navigator.permissions);
  if (origQuery) {
    navigator.permissions.query = (p) =>
      p.name === 'notifications'
        ? Promise.resolve({ state: 'default', onchange: null })
        : origQuery(p);
  }

  // 8. Connection
  Object.defineProperty(navigator, 'connection', {
    get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false })
  });

  // 9. Hide headless in User-Agent data
  if (navigator.userAgentData) {
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: [
          { brand: 'Chromium', version: '124' },
          { brand: 'Google Chrome', version: '124' },
          { brand: 'Not-A.Brand', version: '99' },
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async () => ({
          architecture: 'x86',
          bitness: '64',
          brands: [{ brand: 'Google Chrome', version: '124' }],
          fullVersionList: [{ brand: 'Google Chrome', version: '124.0.0.0' }],
          mobile: false,
          model: '',
          platform: 'Windows',
          platformVersion: '10.0.0',
          uaFullVersion: '124.0.0.0',
        }),
      })
    });
  }
})();
`;

// ── Human simulation ──────────────────────────────────────────────────────────
async function simulateHuman(page: Page): Promise<void> {
  try {
    await page.mouse.move(200 + Math.random() * 300, 100 + Math.random() * 200, { steps: 15 });
    await page.waitForTimeout(400 + Math.random() * 600);
    await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 300));
    await page.waitForTimeout(300 + Math.random() * 400);
    await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 150, { steps: 10 });
    await page.waitForTimeout(200 + Math.random() * 300);
  } catch { /* page may have navigated */ }
}

// ── Stealth context ────────────────────────────────────────────────────────────
async function createStealthContext(browser: any): Promise<BrowserContext> {
  const width  = 1280 + Math.floor(Math.random() * 240);
  const height = 720  + Math.floor(Math.random() * 120);

  const ctx = await browser.newContext({
    userAgent:   UA,
    viewport:    { width, height },
    locale:      "en-US",
    timezoneId:  "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language":           "en-US,en;q=0.9",
      "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-ch-ua":                 `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
      "sec-ch-ua-mobile":          "?0",
      "sec-ch-ua-platform":        '"Windows"',
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Inject BEFORE any page script runs — critical for Cloudflare bypass
  await ctx.addInitScript({ content: STEALTH_SCRIPT });

  return ctx;
}

// ── Probe: verify URL is reachable from server IP ─────────────────────────────
async function probeUrl(url: string, headers: Record<string, string>): Promise<boolean> {
  let cleanUrl = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("headers");
    u.searchParams.delete("host");
    cleanUrl = u.toString();
  } catch { /* keep original */ }

  const h: Record<string, string> = { "User-Agent": UA, "Range": "bytes=0-1023" };
  if (headers["referer"]) h["Referer"] = headers["referer"];
  if (headers["origin"])  h["Origin"]  = headers["origin"];

  try {
    const res = await fetch(cleanUrl, { method: "GET", headers: h, signal: AbortSignal.timeout(8_000) });
    const ok = [200, 206, 301, 302].includes(res.status);
    if (!ok) console.warn(`[stream] probe ${res.status} → ${cleanUrl.slice(0, 70)}`);
    try { const r = res.body?.getReader(); if (r) { await r.read(); r.cancel(); } } catch {}
    return ok;
  } catch (err) {
    console.warn(`[stream] probe err → ${cleanUrl.slice(0, 60)}:`, (err as Error).message);
    return false;
  }
}

// ── Main Playwright extraction ────────────────────────────────────────────────
// ── Videasy direct API extraction ────────────────────────────────────────────
// Videasy loads stream data from a JSON API endpoint before making any media
// request. In headless mode its player detects automation and serves an empty
// shell — but the API itself is not bot-protected.
async function extractVideasy(id: string): Promise<{
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
} | null> {
  const apis = [
    `https://player.videasy.net/api/e/movie/${id}`,
    `https://player.videasy.net/api/movie/${id}`,
  ];

  const headers: Record<string, string> = {
    "User-Agent":  UA,
    "Referer":     `https://player.videasy.net/movie/${id}`,
    "Origin":      "https://player.videasy.net",
    "Accept":      "application/json, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  for (const api of apis) {
    try {
      const res = await fetch(api, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { console.warn(`[stream] Videasy API ${res.status}: ${api}`); continue; }

      const json = await res.json().catch(() => null);
      if (!json) continue;

      // Videasy returns different shapes — try common paths
      const streamUrl: string | undefined =
        json?.stream?.url ?? json?.url ?? json?.source ?? json?.data?.url ??
        json?.data?.stream ?? json?.file ?? json?.src ??
        // Sometimes nested under "sources" array
        (Array.isArray(json?.sources) ? json.sources[0]?.file ?? json.sources[0]?.src : undefined) ??
        (Array.isArray(json?.data?.sources) ? json.data.sources[0]?.file : undefined);

      if (streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes(".mp4"))) {
        console.log(`[stream] Videasy API ✓ → ${streamUrl.slice(0, 80)}`);
        const proxyHeaders = { referer: "https://player.videasy.net/", origin: "https://player.videasy.net" };
        const ok = await probeUrl(streamUrl, proxyHeaders);
        if (ok) return { streamUrl, proxyHeaders, source: "Videasy" };
        console.warn(`[stream] Videasy API probe failed`);
      } else {
        console.warn(`[stream] Videasy API: no stream in response — keys: ${Object.keys(json ?? {}).join(", ")}`);
      }
    } catch (err) {
      console.warn(`[stream] Videasy API err:`, (err as Error).message);
    }
  }
  return null;
}

async function extractStream(id: string): Promise<{
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
} | null> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--mute-audio",
      "--hide-scrollbars",
    ],
  });

  // ── Probe one source in its own context ────────────────────────────────────
  async function trySource(src: { name: string; url: string }): Promise<{
    streamUrl: string; proxyHeaders: Record<string, string>; source: string;
  } | null> {
    let ctx: BrowserContext | null = null;
    let page: Page | null = null;
    try {
      ctx  = await createStealthContext(browser);
      page = await ctx.newPage();
    } catch (e) {
      console.error(`[stream] context err ${src.name}:`, e);
      return null;
    }

    const candidates: Array<{ url: string; headers: Record<string, string> }> = [];

    const onRequest = (req: any) => {
      const url = req.url();
      if (SKIP_RE.test(url))    return;
      if (isBlockedCdn(url))    return;
      if (!isMediaUrl(url))     return;
      if (candidates.some(c => c.url === url)) return;
      candidates.push({ url, headers: req.headers() });
    };
    const onResponse = (res: any) => {
      const url = res.url();
      if (SKIP_RE.test(url))    return;
      if (isBlockedCdn(url))    return;
      if (!isMediaUrl(url))     return;
      if (candidates.some(c => c.url === url)) return;
      candidates.push({ url, headers: res.request().headers() });
    };
    ctx.on("request",  onRequest);
    ctx.on("response", onResponse);

    try {
      await page.goto(src.url, { timeout: 30_000, waitUntil: "load" });
      await simulateHuman(page);

      // ── Phase 1: wait up to 8s for autoplay sources (VidLink fires immediately) ──
      const phase1 = Date.now() + 8_000;
      while (Date.now() < phase1) {
        if (candidates.length > 0) break;
        await page.waitForTimeout(300);
      }

      // ── Phase 2: if still nothing, try clicking play buttons ─────────────────
      // Some players (Videasy, VidKing) require a click to start playback.
      // Try common play button selectors and the centre of the page.
      if (candidates.length === 0) {
        const playSelectors = [
          // Videasy specific
          ".play-button", ".vjs-big-play-button", ".jw-display-icon-container",
          // Generic HTML5 / overlay play buttons
          "[class*='play']", "[aria-label*='Play']", "[title*='Play']",
          "button.play", ".plyr__control--overlaid", ".fp-play",
          // Last resort: centre click (many players start on any click)
          null,
        ];
        for (const sel of playSelectors) {
          if (candidates.length > 0) break;
          try {
            if (sel) {
              const el = await page.$(sel);
              if (el) {
                await el.click({ timeout: 1_000 });
                console.log(`[stream] ${src.name}: clicked "${sel}"`);
                await page.waitForTimeout(2_000);
              }
            } else {
              // Centre-of-viewport click — triggers most overlay play buttons
              const vp = page.viewportSize();
              if (vp) {
                await page.mouse.click(vp.width / 2, vp.height / 2);
                console.log(`[stream] ${src.name}: centre click fallback`);
                await page.waitForTimeout(3_000);
              }
            }
          } catch { /* selector not found or click failed — keep trying */ }
        }
      }

      // ── Phase 3: final 7s wait after any click attempts ──────────────────────
      if (candidates.length === 0) {
        const phase3 = Date.now() + 7_000;
        while (Date.now() < phase3) {
          if (candidates.length > 0) break;
          await page.waitForTimeout(300);
        }
      }

      const title = await page.title().catch(() => "");
      if (candidates.length === 0) {
        const cf = title.includes("Just a moment") || title.includes("Attention Required");
        console.warn(`[stream] ${src.name}: 0 candidates — title: "${title}"${cf ? " (CF block)" : ""}`);
      } else {
        console.log(`[stream] ${src.name}: ${candidates.length} candidate(s) — title: "${title}"`);
      }
    } catch (navErr) {
      console.warn(`[stream] nav error ${src.name}:`, (navErr as Error).message);
    } finally {
      try { await page?.close(); } catch {}
      try { await ctx?.close();  } catch {}
    }

    for (const c of candidates) {
      const ok = await probeUrl(c.url, c.headers);
      if (ok) {
        console.log(`[stream] ✓ ${src.name} → ${c.url.slice(0, 80)}`);
        return { streamUrl: c.url, proxyHeaders: c.headers, source: src.name };
      }
      console.warn(`[stream] ✗ probe failed → ${c.url.slice(0, 60)}`);
    }
    console.warn(`[stream] ✗ ${src.name} — no reachable URL`);
    return null;
  }

  // ── Run sources with concurrency=2, return first success ─────────────────
  // Sequential (old): 7 sources × ~30s = 3.5min worst case.
  // Parallel/2 (new): ceil(7/2) × ~30s = ~60s worst case — 3.5× faster.
  try {
    const sources = SOURCES(id);
    const CONCURRENCY = 2;

    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      const batch = sources.slice(i, i + CONCURRENCY);
      // Race the batch — but we want the first *successful* result, not just first settled.
      // Use Promise.allSettled so a failure in one doesn't cancel the other.
      const results = await Promise.allSettled(batch.map(src => trySource(src)));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          return r.value;
        }
      }
    }
  } finally {
    try { await browser.close(); } catch {}
  }

  return null;
}

// ── Deduplicated extraction wrapper ──────────────────────────────────────────
// Builds the full StreamApiResponse and handles caching in one place so the
// in-flight map and cache map stay in sync.
async function getStream(id: string): Promise<StreamApiResponse> {
  const embedSources = EMBEDS(id);
  const embedUrl     = embedSources[0]!.url;

  // ── Try Videasy API first — no Playwright needed, sub-second response ──
  const videasyResult = await extractVideasy(id);
  if (videasyResult) {
    return { ...videasyResult, embedSources, embedUrl };
  }

  const result = await extractStream(id);

  if (result) {
    return { ...result, embedSources, embedUrl };
  }
  return { streamUrl: null, proxyHeaders: null, source: null, embedSources, embedUrl };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id   = req.nextUrl.searchParams.get("id");
  const bust = req.nextUrl.searchParams.get("bust");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  // ── Cache check (skip on bust) ────────────────────────────────────────────
  if (!bust) {
    const hit = CACHE.get(id);
    if (hit && hit.expires > Date.now()) {
      return NextResponse.json(hit.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=600" },
      });
    }
  } else {
    CACHE.delete(id);
    console.log(`[stream] cache busted for id=${id}`);
  }

  // ── FIX 1: In-flight deduplication ───────────────────────────────────────
  // If another request for the same id is already running (e.g. two simultaneous
  // VideoPlayer mounts, React StrictMode double-invoke, or two browser tabs),
  // return the same promise instead of launching a second Playwright session.
  const existing = IN_FLIGHT.get(id);
  if (existing) {
    console.log(`[stream] deduped in-flight request for id=${id}`);
    try {
      const data = await existing;
      return NextResponse.json(data, {
        headers: { "X-Cache": "DEDUP", "Cache-Control": "public, max-age=600" },
      });
    } catch {
      // Fall through — the original will have already logged the error
    }
  }

  const promise = getStream(id).then((data) => {
    // Persist successful results to cache
    if (data.streamUrl) {
      CACHE.set(id, { data, expires: Date.now() + CACHE_TTL });
    }
    return data;
  }).finally(() => {
    IN_FLIGHT.delete(id);
  });

  IN_FLIGHT.set(id, promise);

  try {
    const data = await promise;
    const cacheHeader = data.streamUrl
      ? "public, max-age=600, stale-while-revalidate=60"
      : "no-store";
    return NextResponse.json(data, { headers: { "Cache-Control": cacheHeader } });
  } catch (err: any) {
    console.error("[stream] error:", err?.message, err?.stack);
    const embedSources = EMBEDS(id);
    const data: StreamApiResponse = {
      streamUrl: null, proxyHeaders: null, source: null,
      embedSources, embedUrl: embedSources[0]!.url,
    };
    return NextResponse.json(data, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}