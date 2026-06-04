// app/api/proxy/route.ts

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// IP-session-bound CDN blocklist — tokens are tied to the Playwright browser IP.
// Proxying from the Node process (different IP) always 403/502.
const BLOCKED_CDN_HOSTS = [
  "stormvv.vodvidl.site",
  "vodvidl.site",
  "hakunaymatata.com",
];

function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_CDN_HOSTS.some((b) => host === b || host.endsWith("." + b));
  } catch { return false; }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── URL parser ────────────────────────────────────────────────────────────────
// KEY FIX: Only strip one layer of encoding (%25XX → %XX), never fully decode.
//
// Problem: The old version used iterative decodeURIComponent() which turned
//   %253D → %3D → =
// This breaks CDN signed URLs because the "=" is part of the base64 signature.
// The CDN sees a mangled URL and returns 400.
//
// The correct approach:
//   The browser double-encodes the URL when passing it as a query param:
//     actual CDN URL:  .../token%3D/playlist.m3u8   (%3D = literal "=")
//     passed as param: %253D  (%25 = "%", so %253D = "%3D")
//   We need to go from %253D → %3D (one unescape), NOT %253D → = (two unescapes).
//   This preserves the CDN signature while making the URL valid for fetch().
function parseCdnUrl(raw: string): {
  cleanUrl: string;
  embeddedHeaders: Record<string, string>;
} {
  let embeddedHeaders: Record<string, string> = {};

  // Split path from query
  const qIdx     = raw.indexOf("?");
  const rawPath  = qIdx === -1 ? raw   : raw.slice(0, qIdx);
  const rawQuery = qIdx === -1 ? ""    : raw.slice(qIdx + 1);

  // Parse query — strip ?headers= and ?host=, keep everything else
  const keepParams: string[] = [];
  for (const seg of rawQuery.split("&")) {
    if (!seg) continue;
    const eq  = seg.indexOf("=");
    const key = eq === -1 ? seg          : seg.slice(0, eq);
    const val = eq === -1 ? ""           : seg.slice(eq + 1);

    if (key === "headers") {
      try { embeddedHeaders = JSON.parse(decodeURIComponent(val)); } catch {
        try { embeddedHeaders = JSON.parse(val); } catch {}
      }
    } else if (key === "host") {
      // always drop — never rewrite Host header
    } else {
      keepParams.push(seg);
    }
  }

  // ONE-LAYER UNESCAPE ONLY: %25XX → %XX
  // This undoes the browser's double-encoding of the URL query parameter
  // without breaking CDN signature characters like = + / in the token.
  //
  // Example:
  //   %253D → %3D  ✓ (correct — preserves the literal "=" in the CDN token)
  //   %252B → %2B  ✓ (correct — preserves the literal "+" in the CDN token)
  //
  // We do NOT do a full decodeURIComponent() because that would turn:
  //   %3D → =      ✗ (breaks CDN signature)
  //   %2B → +      ✗ (breaks CDN signature)
  const cleanPath = rawPath.replace(/%25([0-9A-Fa-f]{2})/g, "%$1");

  // Sanity check: must still be an http(s) URL
  if (!cleanPath.startsWith("http://") && !cleanPath.startsWith("https://")) {
    // Fallback — return as-is
    const cleanUrl = keepParams.length > 0
      ? `${rawPath}?${keepParams.join("&")}`
      : rawPath;
    return { cleanUrl, embeddedHeaders };
  }

  const cleanUrl = keepParams.length > 0
    ? `${cleanPath}?${keepParams.join("&")}`
    : cleanPath;

  return { cleanUrl, embeddedHeaders };
}

// ── M3U8 rewriter ─────────────────────────────────────────────────────────────
// Rewrites relative/absolute segment URLs to go through /api/proxy
// so HLS.js can fetch them without CORS issues.
function rewriteM3u8(text: string, baseUrl: string, headersJson: string): string {
  const noQuery = baseUrl.split("?")[0]!;
  const baseDir = noQuery.substring(0, noQuery.lastIndexOf("/") + 1);

  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;

    // Make absolute
    let abs: string;
    if (t.startsWith("http://") || t.startsWith("https://")) {
      abs = t;
    } else if (t.startsWith("//")) {
      abs = "https:" + t;
    } else {
      abs = baseDir + t;
    }

    // Strip any embedded ?headers=/?host= from segment URL
    const { cleanUrl } = parseCdnUrl(abs);
    abs = cleanUrl;

    // Don't proxy blocked CDN segments
    if (isBlockedHost(abs)) {
      console.warn(`[proxy] skipping blocked CDN segment: ${abs.slice(0, 60)}`);
      return line;
    }

    return `/api/proxy?url=${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersJson)}`;
  }).join("\n");
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const rawUrl      = req.nextUrl.searchParams.get("url") ?? "";
  const headersJson = req.nextUrl.searchParams.get("headers") ?? "{}";

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing ?url=" }, { status: 400, headers: CORS });
  }

  let captured: Record<string, string> = {};
  try { captured = JSON.parse(headersJson); } catch {}

  const { cleanUrl, embeddedHeaders } = parseCdnUrl(rawUrl);

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Only http/https allowed" }, { status: 400, headers: CORS });
  }

  if (isBlockedHost(cleanUrl)) {
    console.warn(`[proxy] blocked CDN — fast 403: ${cleanUrl.slice(0, 80)}`);
    return new NextResponse("CDN not proxiable (IP-session-bound token)", {
      status: 403,
      headers: CORS,
    });
  }

  // ── Build fetch headers ───────────────────────────────────────────────────
  const referer =
    captured["referer"]        ?? captured["Referer"]        ??
    embeddedHeaders["referer"] ?? embeddedHeaders["Referer"] ?? "";

  const origin =
    captured["origin"]         ?? captured["Origin"]         ??
    embeddedHeaders["origin"]  ?? embeddedHeaders["Origin"]  ??
    (referer
      ? (() => { try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { return ""; } })()
      : "");

  const fetchHeaders: Record<string, string> = {
    "user-agent":      UA,
    "accept":          "*/*",
    "accept-language": "en-US,en;q=0.9",
  };

  if (referer)            fetchHeaders["referer"]  = referer;
  if (origin)             fetchHeaders["origin"]   = origin;
  if (captured["cookie"]) fetchHeaders["cookie"]   = captured["cookie"];

  // Forward byte-range requests from the browser's video element
  const rangeHeader = req.headers.get("range");
  if (rangeHeader)                fetchHeaders["range"] = rangeHeader;
  else if (captured["range"])     fetchHeaders["range"] = captured["range"];

  // ── Fetch upstream ────────────────────────────────────────────────────────
  try {
    const upstream = await fetch(cleanUrl, {
      headers: fetchHeaders,
      signal:  AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} for ${cleanUrl.slice(0, 100)}`);
      return new NextResponse(`Upstream ${upstream.status}`, {
        status: upstream.status,
        headers: CORS,
      });
    }

    const ct     = upstream.headers.get("content-type") ?? "";
    const isM3u8 =
      ct.includes("mpegurl") ||
      cleanUrl.includes(".m3u8") ||
      rawUrl.includes(".m3u8");

    if (isM3u8) {
      const text = await upstream.text();
      return new NextResponse(rewriteM3u8(text, cleanUrl, headersJson), {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type":  "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        },
      });
    }

    // Stream binary (mp4 segments, ts chunks, etc.)
    const responseHeaders: Record<string, string> = { ...CORS };
    const passthroughHeaders = [
      "content-type", "content-length", "content-range",
      "accept-ranges", "cache-control", "last-modified", "etag",
    ];
    for (const h of passthroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders[h] = v;
    }
    if (!responseHeaders["content-type"]) responseHeaders["content-type"] = "video/mp2t";

    const status = upstream.status === 206 ? 206 : 200;
    return new NextResponse(upstream.body, { status, headers: responseHeaders });

  } catch (err) {
    console.error("[proxy] fetch error:", err);
    return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
  }
}