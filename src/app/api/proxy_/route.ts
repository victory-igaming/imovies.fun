// app/api/proxy/route.ts
//
// ── PROXY ────────────────────────────────────────────────────────────────────
// Controlled entirely via .env:
//
//   PROXY_ENABLED=false                  → local dev, no proxy, direct fetch
//   PROXY_ENABLED=true
//   PROXY_LIST=socks5://127.0.0.1:9050   → online server, routes through Tor
//
// PROXY_LIST also accepts comma-separated http://user:pass@host:port entries.

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
]);

// ── Proxy config ────────────────────────────────────────────────────────────
const PROXY_ENABLED  = process.env.PROXY_ENABLED === "true";
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

// ── Tor circuit auto-rotation on repeated segment failures ───────────────────
// Stream extraction has its own rotation logic, but a circuit can also go bad
// mid-playback — segments start 502ing/timing out across many different
// movies/sources, not just one. Track consecutive proxy failures process-wide
// and force a fresh Tor circuit once a threshold is crossed, so degraded exit
// nodes self-heal instead of breaking playback for everyone until a manual
// `systemctl restart tor`.
let consecutiveFailures = 0;
let lastSegmentRotation = 0;
const FAILURE_THRESHOLD       = 5;
const MIN_SEGMENT_ROTATE_MS   = 15_000; // don't rotate more than once every 15s

async function rotateTorCircuitIfDegraded(): Promise<void> {
  if (!PROXY_ENABLED || !PROXY_LIST_RAW.includes("socks5")) return;
  if (consecutiveFailures < FAILURE_THRESHOLD) return;

  const now = Date.now();
  if (now - lastSegmentRotation < MIN_SEGMENT_ROTATE_MS) return;

  const net = await import("net");
  const rotated = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection(9051, "127.0.0.1", () => {
      socket.write('AUTHENTICATE ""\r\nSIGNAL NEWNYM\r\nQUIT\r\n');
    });
    socket.setTimeout(3_000);
    let response = "";
    socket.on("data", (d) => { response += d.toString(); });
    socket.on("end", () => { socket.destroy(); resolve(response.includes("250 OK")); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", (err) => {
      console.warn("[proxy] tor control port unreachable:", err.message);
      resolve(false);
    });
  });

  if (rotated) {
    console.warn(`[proxy] ${consecutiveFailures} consecutive failures — rotated Tor circuit`);
    lastSegmentRotation = Date.now();
  }
  consecutiveFailures = 0;
}

// ── Fetcher (direct / HTTP proxy / SOCKS5 proxy) ──────────────────────────────
async function buildFetcher(
  proxyUrl: string,
): Promise<(url: string, init: RequestInit) => Promise<Response>> {
  if (!proxyUrl) return (url, init) => fetch(url, init);

  const isSocks = /^socks[45]h?:\/\//.test(proxyUrl);

  if (isSocks) {
    try {
      const { SocksProxyAgent } = await import("socks-proxy-agent");
      const agent = new SocksProxyAgent(proxyUrl);
      return async (url, init) => {
        const { default: nodeFetch } = await import("node-fetch");
        return nodeFetch(url, { ...(init as any), agent }) as unknown as Response;
      };
    } catch (e) {
      console.warn("[proxy] socks-proxy-agent unavailable, falling back:", (e as Error).message);
    }
  }

  try {
    const undici = await import("undici");
    const agent  = new undici.ProxyAgent(proxyUrl);
    return (url, init) =>
      undici.fetch(url, { ...(init as any), dispatcher: agent }) as unknown as Promise<Response>;
  } catch {
    console.warn("[proxy] undici unavailable, fetching without proxy");
    return (url, init) => fetch(url, init);
  }
}

// ── Multi-layer URL/header decoding ───────────────────────────────────────────
// Some CDNs (e.g. storm.vodvidl.site) wrap their segment URL in nested query
// params that are encoded multiple times: ?headers=%2522...%2522&host=%2526...
// A single decodeURIComponent() isn't enough — unwrap until it stabilises.
function deepDecode(value: string, maxRounds = 3): string {
  let prev = value;
  for (let i = 0; i < maxRounds; i++) {
    let next: string;
    try { next = decodeURIComponent(prev); } catch { break; }
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const targetUrlRaw = searchParams.get("url");
  const headersRaw   = searchParams.get("headers");

  if (!targetUrlRaw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400, headers: CORS });
  }

  // Normalize: decode fully once, then re-encode exactly once downstream.
  // Prevents %2B → %252B style double-encoding that breaks CDN tokens.
  const targetUrl = deepDecode(targetUrlRaw);

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Only http/https allowed" }, { status: 400, headers: CORS });
  }

  let extraHeaders: Record<string, string> = {};
  if (headersRaw) {
    try { extraHeaders = JSON.parse(deepDecode(headersRaw)); } catch {}
  }

  const fetchHeaders: Record<string, string> = {
    "user-agent": UA,
    ...extraHeaders,
  };

  if (fetchHeaders["referer"] && !fetchHeaders["origin"]) {
    try {
      const u = new URL(fetchHeaders["referer"]);
      fetchHeaders["origin"] = `${u.protocol}//${u.host}`;
    } catch {}
  }

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) fetchHeaders["range"] = rangeHeader;

  const fetchInit: RequestInit = {
    headers: fetchHeaders,
    redirect: "follow",
    // 10s, not 30s — HLS.js's own fragLoadingTimeOut is 30s. With the old
    // 30s timeout × up to 3 retries, a single bad segment could keep HLS.js
    // waiting up to 90s, guaranteeing it gives up and escalates to a fatal
    // error before we ever got a chance to respond. Fail fast instead so
    // there's still time left in HLS.js's own budget for a retry to land.
    signal: AbortSignal.timeout(10_000),
  };

  if (!PROXY_ENABLED) {
    console.log("[proxy] PROXY_ENABLED=false — direct fetch (no proxy)");
  }

  const proxyUrl       = pickProxy();
  const upstreamFetch  = await buildFetcher(proxyUrl);

  // Only log proxy usage for m3u8/playlist requests, not every single
  // .ts segment — keeps logs readable without losing visibility.
  if (proxyUrl && (targetUrl.includes(".m3u8") || targetUrl.includes("playlist"))) {
    console.log(`[proxy] using proxy ${maskProxy(proxyUrl)} for playlist`);
  }

  // Retry transient upstream failures (502/503/504, timeouts, dropped Tor
  // connections) before giving up. Cap total time spent retrying at well
  // under HLS.js's fragLoadingTimeOut (30s) so a slow/dead segment doesn't
  // eat the player's entire retry budget before we even respond.
  const MAX_ATTEMPTS         = 2; // 1 retry only — fail fast, let HLS.js's own retry pick up the rest
  const RETRY_BACKOFF_MS     = 200;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const upstream = await upstreamFetch(targetUrl, fetchInit);

      const isTransient = upstream.status === 502 || upstream.status === 503 || upstream.status === 504;
      if (isTransient && attempt < MAX_ATTEMPTS) {
        console.warn(`[proxy] ${upstream.status} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying: ${targetUrl.slice(0, 100)}`);
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        continue;
      }

      if (!upstream.ok) {
        console.error(`[proxy] ${upstream.status} for ${targetUrl.slice(0, 100)}`);
        consecutiveFailures++;
        await rotateTorCircuitIfDegraded();
        return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status, headers: CORS });
      }

      // Success — clear the failure streak.
      consecutiveFailures = 0;

      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
      const isM3u8 = contentType.includes("mpegurl") || targetUrl.split("?")[0]!.endsWith(".m3u8");

      if (isM3u8) {
        const text = await upstream.text();
        const base = new URL(targetUrl);
        const hEnc = encodeURIComponent(JSON.stringify(extraHeaders));

        const rewritten = text.split("\n").map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;

          let segUrl: string;
          if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            segUrl = trimmed;
          } else if (trimmed.startsWith("//")) {
            segUrl = `${base.protocol}${trimmed}`;
          } else if (trimmed.startsWith("/")) {
            segUrl = `${base.protocol}//${base.host}${trimmed}`;
          } else {
            const dir = base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
            segUrl = `${base.protocol}//${base.host}${dir}${trimmed}`;
          }

          // Normalize segment URL too — strip any pre-existing encoding before
          // re-encoding once, same reasoning as deepDecode() above.
          const normalizedSeg = deepDecode(segUrl);
          return `/api/proxy?url=${encodeURIComponent(normalizedSeg)}&headers=${hEnc}`;
        }).join("\n");

        return new NextResponse(rewritten, {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
        });
      }

      const responseHeaders: Record<string, string> = { ...CORS, "Content-Type": contentType };
      for (const h of ["content-range", "accept-ranges", "cache-control", "last-modified", "etag"]) {
        const v = upstream.headers.get(h);
        if (v && !HOP_BY_HOP.has(h)) responseHeaders[h] = v;
      }
      if (!responseHeaders["cache-control"]) responseHeaders["cache-control"] = "public, max-age=3600";

      const status = upstream.status === 206 ? 206 : 200;
      return new NextResponse(upstream.body, { status, headers: responseHeaders });

    } catch (err: any) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[proxy] fetch error (attempt ${attempt}/${MAX_ATTEMPTS}): ${err?.message} — retrying`);
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
    }
  }

  console.error("[proxy] fetch error after retries:", (lastErr as any)?.message);
  consecutiveFailures++;
  await rotateTorCircuitIfDegraded();
  return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}