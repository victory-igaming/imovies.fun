// app/api/proxy/route.ts

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Parse a CDN URL without using new URL() to mutate the path.
 *
 * The problem with URL():
 *   u.pathname = decodeURIComponent(u.pathname)
 *   → URL re-encodes it on assignment, undoing the fix.
 *
 * Strategy: work entirely on the raw string.
 *   1. Split path and query manually
 *   2. Strip ?headers= and ?host= from query
 *   3. Fully decode the path (handles %252F→%2F→/ in one pass)
 *   4. Re-assemble
 */
function parseCdnUrl(raw: string): {
  cleanUrl: string;
  embeddedHeaders: Record<string, string>;
} {
  let embeddedHeaders: Record<string, string> = {};

  // Split path from query string
  const qIdx      = raw.indexOf("?");
  const rawPath   = qIdx === -1 ? raw        : raw.slice(0, qIdx);
  const rawQuery  = qIdx === -1 ? ""         : raw.slice(qIdx + 1);

  // Parse query params — drop ?headers= and ?host=, keep everything else
  const keepParams: string[] = [];
  for (const seg of rawQuery.split("&")) {
    if (!seg) continue;
    const eq  = seg.indexOf("=");
    const key = eq === -1 ? seg : seg.slice(0, eq);
    const val = eq === -1 ? ""  : seg.slice(eq + 1);

    if (key === "headers") {
      try { embeddedHeaders = JSON.parse(decodeURIComponent(val)); } catch {
        try { embeddedHeaders = JSON.parse(val); } catch {}
      }
    } else if (key === "host") {
      // drop — never rewrite host
    } else {
      keepParams.push(seg);
    }
  }

  // Fully decode the path.
  // storm.vodvidl.site needs /proxy/file2/<token>/playlist.m3u8
  // but we receive it as /proxy/file2%2F<token>%2Fplaylist.m3u8 (or %252F etc.)
  // decodeURIComponent handles all levels in one shot.
  let cleanPath = rawPath;
  try {
    // Keep decoding until stable (handles double/triple encoding)
    let prev = "";
    while (prev !== cleanPath) {
      prev = cleanPath;
      cleanPath = decodeURIComponent(cleanPath);
    }
  } catch {
    cleanPath = rawPath; // malformed — use original
  }

  const cleanUrl = keepParams.length > 0
    ? `${cleanPath}?${keepParams.join("&")}`
    : cleanPath;

  return { cleanUrl, embeddedHeaders };
}

function rewriteM3u8(text: string, baseUrl: string, headersJson: string): string {
  // baseUrl is already decoded — derive the base directory from it
  const noQuery = baseUrl.split("?")[0]!;
  const baseDir = noQuery.substring(0, noQuery.lastIndexOf("/") + 1);

  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;

    let abs: string;
    if (t.startsWith("http://") || t.startsWith("https://")) {
      abs = t;
    } else if (t.startsWith("//")) {
      abs = "https:" + t;
    } else {
      abs = baseDir + t;
    }

    // Strip embedded ?headers=/?host= from segment URLs
    const { cleanUrl } = parseCdnUrl(abs);
    abs = cleanUrl;

    return `/api/proxy?url=${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersJson)}`;
  }).join("\n");
}

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

  const referer =
    captured["referer"]  ?? captured["Referer"]  ??
    embeddedHeaders["referer"] ?? embeddedHeaders["Referer"] ?? "";
  const origin =
    captured["origin"]   ?? captured["Origin"]   ??
    embeddedHeaders["origin"]  ?? embeddedHeaders["Origin"]  ??
    (referer ? (() => {
      try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { return ""; }
    })() : "");

  const fetchHeaders: Record<string, string> = {
    "user-agent":      UA,
    "accept":          "*/*",
    "accept-language": "en-US,en;q=0.9",
  };
  if (referer) fetchHeaders["referer"] = referer;
  if (origin)  fetchHeaders["origin"]  = origin;
  if (captured["cookie"]) fetchHeaders["cookie"] = captured["cookie"];
  if (captured["range"])  fetchHeaders["range"]  = captured["range"];

  try {
    const upstream = await fetch(cleanUrl, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} for ${cleanUrl.slice(0, 100)}`);
      return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status, headers: CORS });
    }

    const ct     = upstream.headers.get("content-type") ?? "";
    const isM3u8 = ct.includes("mpegurl") || cleanUrl.includes(".m3u8") || rawUrl.includes(".m3u8");

    if (isM3u8) {
      const text = await upstream.text();
      return new NextResponse(rewriteM3u8(text, cleanUrl, headersJson), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      });
    }

    const responseHeaders: Record<string, string> = { ...CORS };
    for (const h of ["content-type","content-length","content-range","accept-ranges","cache-control","last-modified","etag"]) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders[h] = v;
    }
    if (!responseHeaders["content-type"]) responseHeaders["content-type"] = "video/mp2t";

    return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });

  } catch (err) {
    console.error("[proxy] fetch error:", err);
    return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
  }
}