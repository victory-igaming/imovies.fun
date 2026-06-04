// src/app/api/stream/route.ts
//
// Stealth Playwright extraction with residential proxy pool + tunnel-failure retry.
//
// ERR_TUNNEL_CONNECTION_FAILED fix:
//   When a proxy tunnel fails (dead proxy), we detect it and automatically retry
//   with a different proxy from the pool — up to MAX_PROXY_RETRIES times per source.
//   If all proxies fail, we fall back to direct (no proxy) as a last resort.
//
// GET /api/stream?id=<tmdb_id>        — uses 10-min cache
// GET /api/stream?id=<tmdb_id>&bust=1 — clears cache

import { NextRequest, NextResponse } from "next/server";
import { chromium, type BrowserContext, type Page } from "playwright";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Proxy pool ────────────────────────────────────────────────────────────────
const RAW_PROXY_LIST = process.env.PROXY_LIST ?? process.env.PROXY_URL ?? "";

function parseProxyList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
      const parts = entry.split(":");
      if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        return `http://${user}:${pass}@${host}:${port}`;
      }
      return entry;
    });
}

// Respect the same PROXY_ENABLED flag used by the proxy route
const PROXY_ENABLED = process.env.PROXY_ENABLED !== "false";
const PROXY_POOL: string[] = PROXY_ENABLED ? parseProxyList(RAW_PROXY_LIST) : [];

let _lastProxyIdx = -1;
function getProxy(exclude?: string): string {
  if (PROXY_POOL.length === 0) return "";
  const candidates = exclude ? PROXY_POOL.filter(p => p !== exclude) : PROXY_POOL;
  if (candidates.length === 0) return "";
  let idx: number;
  do { idx = Math.floor(Math.random() * PROXY_POOL.length); }
  while (PROXY_POOL[idx] === exclude && PROXY_POOL.length > 1);
  _lastProxyIdx = idx;
  return PROXY_POOL[idx]!;
}

function maskProxy(url: string): string {
  return url.replace(/:([^@]+)@/, ":***@");
}

// ── Tunnel failure detection ──────────────────────────────────────────────────
// ERR_TUNNEL_CONNECTION_FAILED means the proxy itself is unreachable/dead.
// Detect it so we can retry with a different proxy.
function isTunnelError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  return (
    msg.includes("ERR_TUNNEL_CONNECTION_FAILED") ||
    msg.includes("ERR_PROXY_CONNECTION_FAILED") ||
    msg.includes("ERR_SOCKS_CONNECTION_FAILED") ||
    msg.includes("net::ERR_TUNNEL") ||
    msg.includes("tunneling socket") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") && msg.includes("proxy")
  );
}

// ── Sources ───────────────────────────────────────────────────────────────────
const SOURCES = (id: string) => [
  { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
  { name: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
  { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
  { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
  { name: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
  { name: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
  { name: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
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

// ── URL helpers ───────────────────────────────────────────────────────────────
function isMediaUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(m3u8|mp4|mkv|webm|ts)$/.test(path);
  } catch {
    return /\.(m3u8|mp4|mkv|webm|ts)$/.test(url.split("?")[0]!.toLowerCase());
  }
}

const SKIP_RE = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha|googlevideo\.com|jwpltx\.com|jwpsrv\.com|imasdk\.googleapis/i;

const BLOCKED_CDN_HOSTS = ["stormvv.vodvidl.site", "vodvidl.site", "hakunaymatata.com"];
function isBlockedCdn(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_CDN_HOSTS.some((b) => host === b || host.endsWith("." + b));
  } catch { return false; }
}

// Short-lived CDN token hosts — skip probe, trust URL directly
const SKIP_PROBE_HOSTS = [
  "ironwallnet.com", "typhoontigertribe.net", "nebulanovanature.net",
  "blizzardbeargazer.com", "solarstraysociety.com", "skywardslothnetwork.net",
  "lunarleopardlife.net", "cosmiccrittercrew.com", "astroalpacarain.com",
];
function shouldSkipProbe(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SKIP_PROBE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch { return false; }
}

// ── Cache + in-flight dedup ───────────────────────────────────────────────────
const CACHE     = new Map<string, { data: StreamApiResponse; expires: number }>();
// Short-lived CDN tokens expire in ~30s, so cache only 90s for those URLs.
// Regular streams are cached for 3 minutes (reduced from 10 to avoid serving stale tokens).
const CACHE_TTL     = 3 * 60 * 1000;   // 3 min for normal streams
const CACHE_TTL_SHORT = 85 * 1000;      // 85s for short-lived CDN token streams
const IN_FLIGHT = new Map<string, Promise<StreamApiResponse>>();

export interface StreamApiResponse {
  streamUrl:    string | null;
  proxyHeaders: Record<string, string> | null;
  usedProxy:    string | null;
  source:       string | null;
  embedSources: Array<{ name: string; url: string }>;
  embedUrl:     string;
}

// ── Stealth init script ───────────────────────────────────────────────────────
const STEALTH_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  delete navigator.__proto__.webdriver;
  const makePlugin = (name, filename, desc, mimeTypes) => {
    const plugin = Object.create(Plugin.prototype);
    Object.defineProperties(plugin, {
      name: { value: name, enumerable: true }, filename: { value: filename, enumerable: true },
      description: { value: desc, enumerable: true }, length: { value: mimeTypes.length },
    });
    mimeTypes.forEach((mt, i) => { plugin[i] = mt; });
    return plugin;
  };
  const pluginArr = [
    makePlugin('PDF Viewer','internal-pdf-viewer','Portable Document Format',[]),
    makePlugin('Chrome PDF Viewer','mhjfbmdgcfjbbpaeojofohoefgiehjai','',[]),
    makePlugin('Chromium PDF Viewer','internal-pdf-viewer','',[]),
    makePlugin('Microsoft Edge PDF Viewer','internal-pdf-viewer','',[]),
    makePlugin('WebKit built-in PDF','internal-pdf-viewer','',[]),
  ];
  Object.defineProperty(navigator,'plugins',{get:()=>{const arr=[...pluginArr];arr.item=i=>arr[i];arr.namedItem=n=>arr.find(p=>p.name===n)||null;arr.refresh=()=>{};Object.setPrototypeOf(arr,PluginArray.prototype);return arr;}});
  Object.defineProperty(navigator,'languages',{get:()=>['en-US','en']});
  Object.defineProperty(screen,'width',{get:()=>1920});Object.defineProperty(screen,'height',{get:()=>1080});
  Object.defineProperty(screen,'availWidth',{get:()=>1920});Object.defineProperty(screen,'availHeight',{get:()=>1040});
  Object.defineProperty(screen,'colorDepth',{get:()=>24});
  Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});
  Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
  window.chrome=window.chrome||{};window.chrome.runtime=window.chrome.runtime||{};
  const origQuery=navigator.permissions?.query?.bind(navigator.permissions);
  if(origQuery)navigator.permissions.query=(p)=>p.name==='notifications'?Promise.resolve({state:'default',onchange:null}):origQuery(p);
  Object.defineProperty(navigator,'connection',{get:()=>({effectiveType:'4g',rtt:50,downlink:10,saveData:false})});
  if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:()=>({brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'},{brand:'Not-A.Brand',version:'99'}],mobile:false,platform:'Windows',getHighEntropyValues:async()=>({architecture:'x86',bitness:'64',brands:[{brand:'Google Chrome',version:'124'}],fullVersionList:[{brand:'Google Chrome',version:'124.0.0.0'}],mobile:false,model:'',platform:'Windows',platformVersion:'10.0.0',uaFullVersion:'124.0.0.0'})})});}
})();
`;

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

// ── Create stealth context with specific proxy ────────────────────────────────
async function createStealthContext(browser: any, proxyUrl: string): Promise<BrowserContext> {
  const width  = 1280 + Math.floor(Math.random() * 240);
  const height = 720  + Math.floor(Math.random() * 120);

  const ctxOptions: any = {
    userAgent:  UA,
    viewport:   { width, height },
    locale:     "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language":           "en-US,en;q=0.9",
      "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-ch-ua":                 `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
      "sec-ch-ua-mobile":          "?0",
      "sec-ch-ua-platform":        '"Windows"',
      "Upgrade-Insecure-Requests": "1",
    },
  };

  if (proxyUrl) {
    try {
      const u = new URL(proxyUrl);
      ctxOptions.proxy = {
        server:   `${u.protocol}//${u.hostname}:${u.port}`,
        username: decodeURIComponent(u.username) || undefined,
        password: decodeURIComponent(u.password) || undefined,
      };
    } catch {
      console.warn("[stream] Invalid proxy URL — proxy ignored");
    }
  }

  const ctx = await browser.newContext(ctxOptions);
  await ctx.addInitScript({ content: STEALTH_SCRIPT });
  return ctx;
}

// ── Probe URL ─────────────────────────────────────────────────────────────────
async function probeUrl(url: string, headers: Record<string, string>): Promise<boolean> {
  // Short-lived CDN tokens (ironwallnet etc.) expire in ~30s.
  // Do a fast 4s probe to confirm the token is still alive before trusting it.
  // If the probe fails (410/403/timeout), we discard the URL rather than
  // returning a dead stream to the client.
  const shortLived = shouldSkipProbe(url);
  if (shortLived) {
    console.log(`[stream] fast-probing short-lived token → ${url.slice(0, 70)}`);
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
      const res = await fetch(cleanUrl, { method: "GET", headers: h, signal: AbortSignal.timeout(4_000) });
      const ok  = [200, 206, 301, 302].includes(res.status);
      if (!ok) console.warn(`[stream] short-lived token already expired (${res.status}) → ${cleanUrl.slice(0, 70)}`);
      try { const r = res.body?.getReader(); if (r) { await r.read(); r.cancel(); } } catch {}
      return ok;
    } catch (err) {
      console.warn(`[stream] short-lived probe timeout → ${cleanUrl.slice(0, 60)}`);
      return false;
    }
  }
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
    const ok  = [200, 206, 301, 302].includes(res.status);
    if (!ok) console.warn(`[stream] probe ${res.status} → ${cleanUrl.slice(0, 70)}`);
    try { const r = res.body?.getReader(); if (r) { await r.read(); r.cancel(); } } catch {}
    return ok;
  } catch (err) {
    console.warn(`[stream] probe err → ${cleanUrl.slice(0, 60)}:`, (err as Error).message);
    return false;
  }
}

// ── Try one source, with proxy retry on tunnel failure ────────────────────────
const MAX_PROXY_RETRIES = 3; // try up to 3 different proxies before giving up

async function trySource(
  browser: any,
  src: { name: string; url: string },
): Promise<{ streamUrl: string; proxyHeaders: Record<string, string>; usedProxy: string; source: string } | null> {

  let lastFailedProxy = "";

  for (let attempt = 1; attempt <= MAX_PROXY_RETRIES; attempt++) {
    // On first attempt pick any proxy; on retry exclude the failed one
    const proxyUrl = attempt === 1
      ? getProxy()
      : getProxy(lastFailedProxy);

    // On last attempt, try direct (no proxy) as final fallback
    const effectiveProxy = (attempt === MAX_PROXY_RETRIES && !proxyUrl)
      ? ""
      : proxyUrl;

    if (attempt > 1) {
      console.log(`[stream] ${src.name}: retry ${attempt}/${MAX_PROXY_RETRIES} with ${
        effectiveProxy ? maskProxy(effectiveProxy) : "direct (no proxy)"
      }`);
    }

    let ctx: BrowserContext | null = null;
    let page: Page | null = null;
    let tunnelFailed = false;

    try {
      ctx  = await createStealthContext(browser, effectiveProxy);
      page = await ctx.newPage();
    } catch (e) {
      console.error(`[stream] context err ${src.name}:`, e);
      return null;
    }

    const candidates: Array<{ url: string; headers: Record<string, string> }> = [];

    const onRequest = (req: any) => {
      const url = req.url();
      if (SKIP_RE.test(url))  return;
      if (isBlockedCdn(url))  return;
      if (!isMediaUrl(url))   return;
      if (candidates.some(c => c.url === url)) return;
      candidates.push({ url, headers: req.headers() });
    };
    const onResponse = (res: any) => {
      const url = res.url();
      if (SKIP_RE.test(url))  return;
      if (isBlockedCdn(url))  return;
      if (!isMediaUrl(url))   return;
      if (candidates.some(c => c.url === url)) return;
      candidates.push({ url, headers: res.request().headers() });
    };
    ctx.on("request",  onRequest);
    ctx.on("response", onResponse);

    try {
      await page.goto(src.url, { timeout: 30_000, waitUntil: "load" });
      await simulateHuman(page);

      // Phase 1: 8s wait for autoplay
      const phase1End = Date.now() + 8_000;
      while (Date.now() < phase1End) {
        if (candidates.length > 0) break;
        await page.waitForTimeout(300);
      }

      // Phase 2: click-to-play
      if (candidates.length === 0) {
        const selectors = [
          ".vjs-big-play-button", ".jw-display-icon-container",
          "[class*='play-button']", "[aria-label*='Play']", "[title*='Play']",
          "button.play", ".plyr__control--overlaid", null,
        ];
        for (const sel of selectors) {
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
              const vp = page.viewportSize();
              if (vp) {
                await page.mouse.click(vp.width / 2, vp.height / 2);
                console.log(`[stream] ${src.name}: centre click`);
                await page.waitForTimeout(3_000);
              }
            }
          } catch { /* keep trying */ }
        }
      }

      // Phase 3: final 7s wait
      if (candidates.length === 0) {
        const phase3End = Date.now() + 7_000;
        while (Date.now() < phase3End) {
          if (candidates.length > 0) break;
          await page.waitForTimeout(300);
        }
      }

      const title = await page.title().catch(() => "");
      if (candidates.length === 0) {
        const cfBlock = title.includes("Just a moment") || title.includes("Attention Required");
        console.warn(`[stream] ${src.name}: 0 candidates — "${title}"${cfBlock ? " ⚠ CF block" : ""}`);
      } else {
        console.log(`[stream] ${src.name}: ${candidates.length} candidate(s) — "${title}"`);
      }

    } catch (navErr) {
      const errMsg = (navErr as Error).message ?? "";
      if (isTunnelError(navErr)) {
        console.warn(`[stream] ${src.name}: tunnel error on attempt ${attempt} — ${
          effectiveProxy ? maskProxy(effectiveProxy) : "direct"
        }`);
        tunnelFailed = true;
        lastFailedProxy = effectiveProxy;
      } else {
        console.warn(`[stream] nav error ${src.name}:`, errMsg.split("\n")[0]);
      }
    } finally {
      try { await page?.close(); } catch {}
      try { await ctx?.close();  } catch {}
    }

    // If tunnel failed, try next proxy
    if (tunnelFailed) continue;

    // Probe candidates
    for (const c of candidates) {
      const ok = await probeUrl(c.url, c.headers);
      if (ok) {
        console.log(`[stream] ✓ ${src.name} → ${c.url.slice(0, 80)}`);
        return { streamUrl: c.url, proxyHeaders: c.headers, usedProxy: effectiveProxy, source: src.name };
      }
      console.warn(`[stream] ✗ probe failed → ${c.url.slice(0, 60)}`);
    }

    // Candidates found but all probes failed — no point retrying with different proxy
    if (candidates.length > 0) break;

    // No candidates + no tunnel error = content not available on this source
    break;
  }

  console.warn(`[stream] ✗ ${src.name} — no reachable URL`);
  return null;
}

// ── Main extraction ───────────────────────────────────────────────────────────
async function extractStream(id: string): Promise<{
  streamUrl: string; proxyHeaders: Record<string, string>; usedProxy: string; source: string;
} | null> {
  if (PROXY_POOL.length > 0) {
    console.log(`[stream] proxy pool: ${PROXY_POOL.length} proxies available`);
  } else {
    console.warn("[stream] no proxy configured — VPS IPs may be CF-blocked. Set PROXY_LIST in .env");
  }

  let browser: any;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage", "--disable-gpu",
        "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", "--disable-background-networking",
        "--disable-sync", "--disable-default-apps",
        "--mute-audio", "--hide-scrollbars",
      ],
    });
  } catch (launchErr: any) {
    console.error("[stream] Browser launch failed — run: npx playwright install chromium");
    console.error("[stream] launch error:", launchErr?.message?.split("\n")[0]);
    return null;
  }

  try {
    const sources    = SOURCES(id);
    const BATCH_SIZE = 2;
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch   = sources.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(src => trySource(browser, src)));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) return r.value;
      }
    }
  } finally {
    try { await browser.close(); } catch {}
  }

  return null;
}

// ── Wrapper ───────────────────────────────────────────────────────────────────
async function getStream(id: string): Promise<StreamApiResponse> {
  const embedSources = EMBEDS(id);
  const embedUrl     = embedSources[0]!.url;
  const result       = await extractStream(id);
  if (result) return { ...result, embedSources, embedUrl };
  return { streamUrl: null, proxyHeaders: null, usedProxy: null, source: null, embedSources, embedUrl };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id   = req.nextUrl.searchParams.get("id");
  const bust = req.nextUrl.searchParams.get("bust");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

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

  const existing = IN_FLIGHT.get(id);
  if (existing) {
    console.log(`[stream] deduped in-flight request for id=${id}`);
    try {
      const data = await existing;
      return NextResponse.json(data, {
        headers: { "X-Cache": "DEDUP", "Cache-Control": "public, max-age=600" },
      });
    } catch { /* fall through */ }
  }

  const promise = getStream(id).then((data) => {
    if (data.streamUrl) {
      // Use shorter TTL for short-lived CDN token streams
      const ttl = data.streamUrl && shouldSkipProbe(data.streamUrl) ? CACHE_TTL_SHORT : CACHE_TTL;
      CACHE.set(id, { data, expires: Date.now() + ttl });
    }
    return data;
  }).finally(() => {
    IN_FLIGHT.delete(id);
  });

  IN_FLIGHT.set(id, promise);

  try {
    const data      = await promise;
    const cacheCtrl = data.streamUrl
      ? "public, max-age=600, stale-while-revalidate=60"
      : "no-store";
    return NextResponse.json(data, { headers: { "Cache-Control": cacheCtrl } });
  } catch (err: any) {
    console.error("[stream] error:", err?.message, err?.stack);
    const embedSources = EMBEDS(id);
    return NextResponse.json({
      streamUrl: null, proxyHeaders: null, usedProxy: null, source: null,
      embedSources, embedUrl: embedSources[0]!.url,
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}