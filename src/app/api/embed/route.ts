// src/app/api/embed/route.ts
//
// Returns the ordered list of iframe embed sources for a given TMDB movie ID.
// Used by StreamMoviePlayer when native extraction fails.
//
// GET /api/embed?id=<tmdb_id>

import { NextRequest, NextResponse } from "next/server";

export interface EmbedApiResponse {
  sources: Array<{ name: string; url: string }>;
  primary: string;
}

function buildEmbedSources(id: string): Array<{ name: string; url: string }> {
  return [
    { name: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
    { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
    { name: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
    { name: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
    { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
    { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
    { name: "MoviesAPI", url: `https://moviesapi.club/movie/${id}?autoplay=1` },
    { name: "2Embed",    url: `https://2embed.org/embed/movie/tmdb/${id}` },
  ];
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const sources = buildEmbedSources(id);
  const data: EmbedApiResponse = {
    sources,
    primary: sources[0]!.url,
  };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
