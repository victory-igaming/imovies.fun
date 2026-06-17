/**
 * Shared embed / extraction source lists — keep MoviePlayer, StreamMoviePlayer,
 * and /api/stream in sync.
 */

export interface StreamSource {
  name: string;
  url: string;
}

/** Playwright extraction order — Videasy handled separately via extractVideasyPlaywright(). */
export function getExtractionSources(id: string | number): StreamSource[] {
  return [
    { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&player=jw&primaryColor=006fee` },
    { name: "VidLink 2", url: `https://vidlink.pro/movie/${id}?autoplay=1&primaryColor=006fee` },
    { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1` },
    { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1` },
    { name: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true` },
    { name: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=true` },
  ];
}

/** Iframe embed fallback order — Videasy first. */
export function getEmbedSources(id: string | number, muted = false): StreamSource[] {
  const m = muted ? 1 : 0;
  return [
    { name: "Videasy",   url: `https://player.videasy.net/movie/${id}` },
    { name: "VidLink",   url: `https://vidlink.pro/movie/${id}?autoplay=1&muted=${m}&player=jw&primaryColor=006fee` },
    { name: "VidSrc v3", url: `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=1&muted=${m}` },
    { name: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=1&muted=${m}` },
    { name: "NontonGo",  url: `https://www.nontongo.win/embed/movie/${id}?autoplay=1&muted=${m}` },
    { name: "VidKing",   url: `https://www.vidking.net/embed/movie/${id}?autoplay=1&muted=${m}` },
    { name: "MoviesAPI", url: `https://moviesapi.club/movie/${id}?autoplay=1` },
    { name: "2Embed",    url: `https://2embed.org/embed/movie/tmdb/${id}` },
  ];
}

/** UI source picker labels (index 0 = Auto/Stream). */
export function getPlayerSourceList(id: string | number, muted = false) {
  const embeds = getEmbedSources(id, muted);
  return [
    { title: "Auto (Stream)", source: `native:${id}` },
    ...embeds.map((e) => ({ title: e.name, source: e.url })),
  ];
}
