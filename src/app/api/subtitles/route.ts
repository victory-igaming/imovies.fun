// src/app/api/subtitles/route.ts
//
// Fetches subtitle VTT files for a given TMDB movie ID + language.
//
// GET /api/subtitles?id=<tmdb_id>&lang=<code>&title=<movie_title>
//
// Sources tried in order:
//   1. subdl.com  — free, good TMDB ID support, handles si/ta/hi well
//   2. OpenSubtitles REST API — good for en/ar/fr/es etc.
//
// Returns: text/vtt 200, or 404 if nothing found.
//
// Env vars:
//   NEXT_PUBLIC_SUBDIL_API_KEY    — subdl API key (free at subdl.com)
//   OPENSUBTITLES_API_KEY         — improves rate limits
//   OPENSUBTITLES_APP_NAME        — your app name for User-Agent

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Language code maps ────────────────────────────────────────────────────────
const SUBDL_LANG: Record<string, string> = {
  en: "EN", si: "SI", ta: "TA", hi: "HI", ar: "AR",
  fr: "FR", es: "ES", de: "DE", ja: "JA", ko: "KO",
  zh: "ZH", ml: "ML", te: "TE", pt: "PT", ru: "RU",
  it: "IT", nl: "NL", pl: "PL", tr: "TR", sv: "SV",
};

const OS_LANG: Record<string, string> = {
  en: "en", si: "si", ta: "ta", hi: "hi", ar: "ar",
  fr: "fr", es: "es", de: "de", ja: "ja", ko: "ko",
  zh: "zh", ml: "ml", te: "te", pt: "pt", ru: "ru",
  it: "it", nl: "nl", pl: "pl", tr: "tr", sv: "sv",
};

// ── SRT → VTT ─────────────────────────────────────────────────────────────────
function srtToVtt(srt: string): string {
  const text = srt
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
    .replace(/^\uFEFF/, "")                           // strip BOM
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2"); // SRT → VTT timestamps
  return "WEBVTT\n\n" + text;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
interface CacheEntry { vtt: string | null; expires: number; }
const CACHE     = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000;

// ── Zip extractor ─────────────────────────────────────────────────────────────
async function extractSubFromZip(buf: ArrayBuffer): Promise<string | null> {
  try {
    const zlib = await import("zlib");
    const data  = Buffer.from(buf);
    const SIG   = 0x04034b50;
    let offset  = 0;

    while (offset + 30 <= data.length) {
      const sig = data.readUInt32LE(offset);
      if (sig !== SIG) break;

      const compression = data.readUInt16LE(offset + 8);
      const compSize    = data.readUInt32LE(offset + 18);
      const fnLen       = data.readUInt16LE(offset + 26);
      const extraLen    = data.readUInt16LE(offset + 28);
      const fileName    = data.subarray(offset + 30, offset + 30 + fnLen).toString("utf8").toLowerCase();
      const dataOffset  = offset + 30 + fnLen + extraLen;

      if ((fileName.endsWith(".srt") || fileName.endsWith(".vtt")) && compSize > 0) {
        const compressed = data.subarray(dataOffset, dataOffset + compSize);
        let raw: Buffer;
        if (compression === 0) {
          raw = compressed;
        } else if (compression === 8) {
          raw = await new Promise<Buffer>((res, rej) =>
            zlib.inflateRaw(compressed, (e, r) => e ? rej(e) : res(r))
          );
        } else {
          offset = dataOffset + compSize;
          continue;
        }
        const text = raw.toString("utf8");
        return fileName.endsWith(".vtt") ? text : srtToVtt(text);
      }
      offset = dataOffset + compSize;
    }
    return null;
  } catch (err) {
    console.warn("[subtitles] zip extract error:", (err as Error).message);
    return null;
  }
}

// ── Source 1: subdl.com ───────────────────────────────────────────────────────
// Best for Asian/South Asian languages (si, ta, hi, ml, te)
async function fetchFromSubdl(tmdbId: string, title: string, lang: string): Promise<string | null> {
  // Read with fallbacks — handles both SUBDL_API_KEY and the NEXT_PUBLIC_ variants
  // Also handles the common typo SUBDIL vs SUBDL
  const apiKey =
    process.env.SUBDL_API_KEY ??
    process.env.NEXT_PUBLIC_SUBDL_API_KEY ??
    process.env.NEXT_PUBLIC_SUBDIL_API_KEY ??  // typo variant
    "";
  if (!apiKey) {
    console.warn("[subtitles] SUBDL_API_KEY not set — skipping subdl");
    return null;
  }

  const sdLang = SUBDL_LANG[lang] ?? lang.toUpperCase();

  try {
    // Try TMDB ID first — most reliable
    const byId = `https://api.subdl.com/api/v1/subtitles?api_key=${apiKey}&tmdb_id=${tmdbId}&type=movie&languages=${sdLang}&subs_per_page=5`;
    let searchRes = await fetch(byId, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    // Fall back to title search if TMDB ID returns nothing
    if (!searchRes.ok || (await searchRes.clone().json().catch(() => ({}))).subtitles?.length === 0) {
      if (title) {
        const byTitle = `https://api.subdl.com/api/v1/subtitles?api_key=${apiKey}&film_name=${encodeURIComponent(title)}&type=movie&languages=${sdLang}&subs_per_page=5`;
        searchRes = await fetch(byTitle, {
          headers: { "User-Agent": UA, "Accept": "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
      }
    }

    if (!searchRes.ok) {
      console.warn(`[subtitles] subdl ${searchRes.status} tmdb=${tmdbId} lang=${lang}`);
      return null;
    }

    const data = await searchRes.json();
    const subs: any[] = data?.subtitles ?? [];
    if (subs.length === 0) return null;

    const best    = subs[0];
    const zipUrl  = `https://dl.subdl.com${best?.url}`;

    const zipRes = await fetch(zipUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!zipRes.ok) return null;

    const zipBuf = await zipRes.arrayBuffer();
    return await extractSubFromZip(zipBuf);

  } catch (err) {
    console.warn("[subtitles] subdl error:", (err as Error).message);
    return null;
  }
}

// ── Source 2: OpenSubtitles ───────────────────────────────────────────────────
// Good for en/ar/fr/de/es/ja/ko. Requires API key for >5 req/day.
async function fetchFromOpenSubtitles(tmdbId: string, lang: string): Promise<string | null> {
  // Use a valid API key — the public fallback is heavily rate-limited
  const apiKey =
    process.env.OPENSUBTITLES_API_KEY ??
    process.env.NEXT_PUBLIC_OPENSUBTITLES_API_KEY ??
    "";
  if (!apiKey) {
    console.warn("[subtitles] OPENSUBTITLES_API_KEY not set — skipping OpenSubtitles");
    return null;
  }

  const appName = process.env.OPENSUBTITLES_APP_NAME ?? "streamapp v1.0";
  const osLang  = OS_LANG[lang] ?? lang;

  try {
    const searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=${osLang}&type=movie`;
    const searchRes = await fetch(searchUrl, {
      headers: { "Api-Key": apiKey, "User-Agent": appName, "Accept": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (searchRes.status === 403 || searchRes.status === 401) {
      console.warn(`[subtitles] OpenSubtitles ${searchRes.status} — check NEXT_PUBLIC_OPENSUBTITLES_API_KEY`);
      return null;
    }
    if (!searchRes.ok) {
      console.warn(`[subtitles] OpenSubtitles search ${searchRes.status}`);
      return null;
    }

    const searchData = await searchRes.json();
    const files: any[] = searchData?.data ?? [];
    if (files.length === 0) return null;

    const best   = files.find(f => f.attributes?.from_trusted) ?? files[0];
    const fileId = best?.attributes?.files?.[0]?.file_id;
    if (!fileId) return null;

    const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: { "Api-Key": apiKey, "User-Agent": appName, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ file_id: fileId, sub_format: "vtt" }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!dlRes.ok) return null;

    const dlData = await dlRes.json();
    const fileUrl: string | undefined = dlData?.link;
    if (!fileUrl) return null;

    const fileRes = await fetch(fileUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
    if (!fileRes.ok) return null;

    const text = await fileRes.text();
    return text.trimStart().startsWith("WEBVTT") ? text : srtToVtt(text);

  } catch (err) {
    console.warn("[subtitles] OpenSubtitles error:", (err as Error).message);
    return null;
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get("id")    ?? "";
  const lang  = req.nextUrl.searchParams.get("lang")  ?? "en";
  const title = req.nextUrl.searchParams.get("title") ?? "";

  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const cacheKey = `${id}:${lang}`;
  const hit      = CACHE.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    if (!hit.vtt) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(hit.vtt, {
      status: 200,
      headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "public, max-age=1800", "Access-Control-Allow-Origin": "*" },
    });
  }

  console.log(`[subtitles] fetching tmdb=${id} lang=${lang} title="${title}"`);

  // subdl first (better South Asian language support), then OpenSubtitles
  let vtt: string | null = null;

  vtt = await fetchFromSubdl(id, title, lang);

  if (!vtt) {
    console.log(`[subtitles] subdl miss — trying OpenSubtitles tmdb=${id} lang=${lang}`);
    vtt = await fetchFromOpenSubtitles(id, lang);
  }

  CACHE.set(cacheKey, { vtt, expires: Date.now() + CACHE_TTL });

  if (!vtt) {
    console.warn(`[subtitles] no subtitle found for tmdb=${id} lang=${lang}`);
    return new NextResponse("Subtitle not found", { status: 404 });
  }

  console.log(`[subtitles] ✓ found for tmdb=${id} lang=${lang} (${vtt.length} bytes)`);
  return new NextResponse(vtt, {
    status: 200,
    headers: {
      "Content-Type":  "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}