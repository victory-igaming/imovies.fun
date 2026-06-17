/**
 * src/app/api/stream/route.ts
 *
 * /api/stream?id=<tmdb_id>
 * Playwright headless browser intercepts the real HLS/MP4 URL from embed pages.
 * Falls through all sources; returns first successful stream.
 *
 * Setup: npm install playwright && npx playwright install chromium
 *
 * ── PROXY ────────────────────────────────────────────────────────────────────
 * Controlled entirely via .env:
 *
 *   PROXY_ENABLED=false                    → local dev, no proxy, direct connections
 *   PROXY_ENABLED=true
 *   PROXY_LIST=socks5://127.0.0.1:9050     → online server, routes through Tor
 *
 * PROXY_LIST also accepts comma-separated http://user:pass@host:port entries.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Proxy config ────────────────────────────────────────────────────────────
const PROXY_ENABLED = process.env.PROXY_ENABLED === "true";
const PROXY_LIST_RAW = process.env.PROXY_LIST ?? "";

function parseProxyList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // Full URL (http://, https://, socks5://, socks4://) — pass through unchanged
      if (/^(https?|socks[45]h?):\/\//.test(entry)) return entry;
      // host:port:user:pass shorthand — convert to http://
      const parts = entry.split(":");
      if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        return `http://${user}:${pass}@${host}:${port}`;
      }
      return entry;
    });
}

const PROXY_POOL: string[] = PROXY_ENABLED ? parseProxyList(PROXY_LIST_RAW) : [];

function pickProxy(): string {
  if (!PROXY_ENABLED || PROXY_POOL.length === 0) return "";
  return PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)]!;
}

function maskProxy(p: string): string {
  return p.replace(/:[^:@]+@/, ":***@");
}

// ── Tor circuit rotation ───────────────────────────────────────────────────────
// When every source fails in a row, the current Tor exit node is likely dead or
// blocked by all the CDNs we're hitting. Send SIGNAL NEWNYM to Tor's control port
// to force a fresh circuit before giving up entirely.
//
// Requires in /etc/tor/torrc:
//   ControlPort 9051
//   CookieAuthentication 0
let lastTorRotation = 0;
const MIN_ROTATE_INTERVAL_MS = 10_000; // don't hammer the control port

async function rotateTorCircuit(): Promise<boolean> {
  if (!PROXY_ENABLED || !PROXY_LIST_RAW.includes("socks5")) return false;

  const now = Date.now();
  if (now - lastTorRotation < MIN_ROTATE_INTERVAL_MS) {
    console.log("[tor] rotation skipped — too soon since last rotation");
    return false;
  }

  const net = await import("net");
  return new Promise((resolve) => {
    const socket = net.createConnection(9051, "127.0.0.1", () => {
      socket.write('AUTHENTICATE ""\r\nSIGNAL NEWNYM\r\nQUIT\r\n');
    });

    socket.setTimeout(3_000);
    let response = "";

    socket.on("data", (d) => { response += d.toString(); });
    socket.on("end", () => {
      socket.destroy();
      if (response.includes("250 OK")) {
        lastTorRotation = Date.now();
        console.log("[tor] ✓ circuit rotated — new exit node in ~10s");
        resolve(true);
      } else {
        console.warn("[tor] rotation failed — unexpected response:", response.slice(0, 80));
        resolve(false);
      }
    });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", (err) => {
      console.warn("[tor] control port unreachable:", err.message, "— is ControlPort 9051 set in torrc?");
      resolve(false);
    });
  });
}

// ── Sources ───────────────────────────────────────────────────────────────────
function buildSources(mid: string | number) {
  return [
    { title: "VidLink",   url: `https://vidlink.pro/movie/${mid}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidLink 2", url: `https://vidlink.pro/movie/${mid}?autoplay=1&primaryColor=006fee` },
    { title: "Videasy",   url: `https://player.videasy.net/movie/${mid}` },
    { title: "AutoEmbed", url: `https://player.autoembed.cc/embed/movie/${mid}` },
    { title: "Vidfast",   url: `https://vidfast.pro/movie/${mid}?autoPlay=true` },
    { title: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${mid}?autoPlay=true` },
    { title: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${mid}?autoPlay=true` },
  ];
}

const M3U8_RE = /\.m3u8/i;
const MP4_RE  = /\.(mp4|mkv|webm)/i;
const SKIP_RE = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|ads\.|gtag|cloudflare/i;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Chromium launch (Windows/Linux compatible) ────────────────────────────────
async function launchBrowser(chromium: any, proxyUrl: string) {
  const os    = await import("os");
  const isWin = os.platform() === "win32";

  const LAUNCH_ARGS = isWin
    ? ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--mute-audio"]
    : [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage", "--disable-gpu",
        "--no-first-run", "--no-default-browser-check",
        "--mute-audio", "--hide-scrollbars",
      ];

  // Only probe system chromium paths when proxy is enabled (i.e. on the Linux VPS).
  // Local dev (PROXY_ENABLED=false) always uses Playwright's bundled binary.
  let executablePath: string | undefined;
  if (PROXY_ENABLED && !isWin) {
    const fs = await import("fs");
    const candidates = [
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      "/usr/lib64/chromium-browser/chromium-browser",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ].filter(Boolean) as string[];
    executablePath = candidates.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  }

  const launchOpts: any = { headless: true, args: LAUNCH_ARGS };
  if (executablePath) launchOpts.executablePath = executablePath;
  if (proxyUrl) launchOpts.proxy = { server: proxyUrl };

  console.log(
    `[stream] launching chromium (${executablePath ?? "bundled"})` +
    (proxyUrl ? ` via proxy ${maskProxy(proxyUrl)}` : " — direct, no proxy")
  );

  return chromium.launch(launchOpts);
}

// ── Stream URL extraction ──────────────────────────────────────────────────────
async function findStream(embedUrl: string, timeoutMs = 40_000) {
  let chromium: any;
  try {
    chromium = (await import("playwright")).chromium;
  } catch {
    return { streamUrl: null, referer: embedUrl, proxyHeaders: {}, usedProxy: null as string | null };
  }

  const proxyUrl = pickProxy();
  const result = { url: null as string | null, referer: embedUrl, headers: {} as Record<string, string> };

  let browser: any;
  try {
    browser = await launchBrowser(chromium, proxyUrl);
  } catch (err) {
    console.warn("[stream] chromium launch failed:", (err as Error).message);
    return { streamUrl: null, referer: embedUrl, proxyHeaders: {}, usedProxy: null };
  }

  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();

  page.on("request", (req: any) => {
    if (result.url) return;
    const url = req.url() as string;
    if (SKIP_RE.test(url)) return;
    if (M3U8_RE.test(url) || MP4_RE.test(url)) {
      const hdrs = req.headers() as Record<string, string>;
      result.url     = url;
      result.referer = hdrs["referer"] ?? embedUrl;
      result.headers = {
        ...(hdrs["referer"]       ? { referer:       hdrs["referer"]       } : {}),
        ...(hdrs["origin"]        ? { origin:        hdrs["origin"]        } : {}),
        ...(hdrs["authorization"] ? { authorization: hdrs["authorization"] } : {}),
      };
    }
  });

  try {
    await page.goto(embedUrl, { timeout: timeoutMs, waitUntil: "domcontentloaded" });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (result.url) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) {
    console.warn("[stream] nav error:", (err as Error).message.split("\n")[0]);
  }

  try { await page.close();    } catch {}
  try { await ctx.close();     } catch {}
  try { await browser.close(); } catch {}

  return {
    streamUrl:    result.url,
    referer:      result.referer,
    proxyHeaders: result.headers,
    usedProxy:    proxyUrl || null,
  };
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (!PROXY_ENABLED) {
    console.log("[stream] PROXY_ENABLED=false — direct connections (local dev)");
  } else if (PROXY_POOL.length === 0) {
    console.warn("[stream] PROXY_ENABLED=true but PROXY_LIST is empty — falling back to direct");
  } else {
    console.log(`[stream] PROXY_ENABLED=true — proxy pool: ${PROXY_POOL.length} entr${PROXY_POOL.length === 1 ? "y" : "ies"}`);
  }

  const sources = buildSources(id);

  // Pass 1: try every source with the current Tor circuit
  for (const src of sources) {
    const { streamUrl, referer, proxyHeaders, usedProxy } = await findStream(src.url);
    if (!streamUrl) {
      console.warn(`[stream] ✗ ${src.title} — no stream found`);
      continue;
    }
    console.log(`[stream] ✓ ${src.title} → ${streamUrl.slice(0, 80)}`);
    return NextResponse.json({
      streamUrl,
      source: src.title,
      proxyHeaders: { referer, ...proxyHeaders },
      usedProxy,
    });
  }

  // All sources failed on pass 1. If we're using Tor, this usually means the
  // current exit node is dead or blocked by every CDN we tried — rotate to a
  // fresh circuit and retry the full source list once before giving up.
  const rotated = await rotateTorCircuit();
  if (rotated) {
    console.log("[stream] retrying all sources with fresh Tor circuit...");
    await new Promise((r) => setTimeout(r, 8_000)); // give Tor time to build new circuit

    for (const src of sources) {
      const { streamUrl, referer, proxyHeaders, usedProxy } = await findStream(src.url);
      if (!streamUrl) {
        console.warn(`[stream] ✗ ${src.title} (retry) — no stream found`);
        continue;
      }
      console.log(`[stream] ✓ ${src.title} (after rotation) → ${streamUrl.slice(0, 80)}`);
      return NextResponse.json({
        streamUrl,
        source: src.title,
        proxyHeaders: { referer, ...proxyHeaders },
        usedProxy,
      });
    }
  }

  return NextResponse.json({ error: "No stream found" }, { status: 404 });
}