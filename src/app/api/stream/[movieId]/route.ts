import { NextRequest, NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const M3U8_RE  = /https?:\/\/[^\s"'\\<>]+\.m3u8(?:[^\s"'\\<>]*)/gi;
const MP4_RE   = /https?:\/\/[^\s"'\\<>]+\.(mp4|mkv|webm)(?:[^\s"'\\<>]*)/gi;
const SKIP_RE  = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha|cloudflare/i;
const IFRAME_RE = /<iframe[^>]+src=["']([^"']+)["']/gi;
const SCRIPT_RE = /<script[^>]+src=["']([^"']+)["']/gi;

function buildSources(mid: string) {
  return [
    { title: "Videasy",   url: `https://player.videasy.net/movie/${mid}` },
    { title: "VidLink",   url: `https://vidlink.pro/movie/${mid}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidLink 2", url: `https://vidlink.pro/movie/${mid}?autoplay=1&primaryColor=006fee` },
    { title: "VidKing",   url: `https://www.vidking.net/embed/movie/${mid}?autoplay=1` },
    { title: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${mid}?autoplay=1` },
    { title: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${mid}?autoPlay=true` },
    { title: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${mid}?autoPlay=true` },
    { title: "MoviesAPI", url: `https://moviesapi.club/movie/${mid}?autoplay=1` },
  ];
}

function resolveUrl(base: string, href: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function extractStreamUrls(text: string): string[] {
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  M3U8_RE.lastIndex = 0;
  while ((m = M3U8_RE.exec(text)) !== null) {
    const url = m[0].replace(/['"\\]+$/, "");
    if (!SKIP_RE.test(url)) hits.push(url);
  }
  if (hits.length === 0) {
    MP4_RE.lastIndex = 0;
    while ((m = MP4_RE.exec(text)) !== null) {
      const url = m[0].replace(/['"\\]+$/, "");
      if (!SKIP_RE.test(url)) hits.push(url);
    }
  }
  return [...new Set(hits)];
}

async function fetchText(url: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": referer,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function scrapeForStream(
  url: string,
  referer: string,
  depth = 0,
  visited = new Set<string>(),
): Promise<{ streamUrl: string; referer: string } | null> {
  if (depth > 3 || visited.has(url)) return null;
  visited.add(url);

  const html = await fetchText(url, referer);
  if (!html) return null;

  const direct = extractStreamUrls(html);
  if (direct.length > 0) return { streamUrl: direct[0]!, referer: url };

  const scriptSrcs: string[] = [];
  let sm: RegExpExecArray | null;
  SCRIPT_RE.lastIndex = 0;
  while ((sm = SCRIPT_RE.exec(html)) !== null) {
    const src = sm[1]!;
    if (!SKIP_RE.test(src)) scriptSrcs.push(resolveUrl(url, src));
    if (scriptSrcs.length >= 6) break;
  }

  for (const src of scriptSrcs) {
    if (visited.has(src)) continue;
    visited.add(src);
    const js = await fetchText(src, url);
    if (js) {
      const hits = extractStreamUrls(js);
      if (hits.length > 0) return { streamUrl: hits[0]!, referer: url };
    }
  }

  if (depth < 2) {
    const iframeSrcs: string[] = [];
    let im: RegExpExecArray | null;
    IFRAME_RE.lastIndex = 0;
    while ((im = IFRAME_RE.exec(html)) !== null) {
      const src = im[1]!;
      if (!SKIP_RE.test(src)) iframeSrcs.push(resolveUrl(url, src));
    }
    for (const iframe of iframeSrcs) {
      const result = await scrapeForStream(iframe, url, depth + 1, visited);
      if (result) return result;
    }
  }

  return null;
}

/**
 * GET /api/stream/[movieId]
 *
 * Scrapes embed sources for a raw m3u8/mp4 stream URL.
 * Always returns embedUrl so the client can fall back to an iframe.
 *
 * 200: { streamUrl, referer, source, embedUrl }
 * 404: { error, embedUrl }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ movieId: string }> },
) {
  const { movieId } = await params;
  const sources = buildSources(movieId);
  const embedUrl = sources[0]!.url;

  for (const src of sources) {
    console.log(`[stream] Trying ${src.title}: ${src.url}`);
    const result = await scrapeForStream(src.url, src.url);
    if (result) {
      console.log(`[stream] Found stream via ${src.title}: ${result.streamUrl}`);
      return NextResponse.json({
        streamUrl: result.streamUrl,
        referer: result.referer,
        source: src.title,
        embedUrl,
      });
    }
  }

  return NextResponse.json(
    { error: "No raw stream found", embedUrl },
    { status: 404 },
  );
}
