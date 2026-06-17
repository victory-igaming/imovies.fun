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
    signal: AbortSignal.timeout(30_000),
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

  try {
    const upstream = await upstreamFetch(targetUrl, fetchInit);

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} for ${targetUrl.slice(0, 100)}`);
      return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status, headers: CORS });
    }

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
    console.error("[proxy] fetch error:", err?.message);
    return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}