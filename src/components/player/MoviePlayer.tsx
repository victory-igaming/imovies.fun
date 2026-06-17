"use client";

/**
 * MoviePlayer
 * ─────────────────────────────────────────────────────────────────────────────
 * Mode 1 — "native"  → VideoPlayer calls /api/stream (Playwright).
 *                       If stream found: <video> plays it + PlayerControls shown.
 *                       If not found:    silent fallback → Mode 2.
 *
 * Mode 2 — "embed"   → StreamMoviePlayer (iframe embeds: Videasy, VidLink…).
 *                       PlayerControls HIDDEN — iframe has its own UI.
 *                       Minimal floating bar: Mute + Fullscreen + Source switcher.
 *
 * Ads work in both modes. SourceSelector lets the user force any source.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import useAdInjection    from "@/hooks/useAdInjection";
import VideoPlayer       from "@/components/player/VideoPlayer";
import StreamMoviePlayer from "@/components/player/StreamMoviePlayer";
import PlayerControls    from "@/components/player/PlayerControls";
import AdOverlayPlayer   from "@/components/player/AdOverlayPlayer";
import SourceSelector    from "@/components/player/SourceSelector";
import DebugPanel        from "@/components/player/DebugPanel";
import { type SubtitleTrack } from "@/components/player/SubtitleSelector";

interface Props { movie: any; }

// Set NEXT_PUBLIC_SHOW_NEXT_SOURCE=true in .env to show "Next Source" button
const SHOW_NEXT_SOURCE = process.env.NEXT_PUBLIC_SHOW_NEXT_SOURCE === "true";

export default function MoviePlayer({ movie }: Props) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [playing,        setPlaying]        = useState(true);
  const [watchTime,      setWatchTime]      = useState(0);
  const [duration,       setDuration]       = useState((movie.runtime || 120) * 60);
  const [isMuted,        setIsMuted]        = useState(false);
  const [isZoomed,       setIsZoomed]       = useState(false);
  const [showSources,    setShowSources]    = useState(false);
  const [sourceName,     setSourceName]     = useState("Loading…");
  const [forceSourceIdx, setForceSourceIdx] = useState<number | undefined>(undefined);
  const [seekTo,         setSeekTo]         = useState<number | null>(null);
  const [showControls,   setShowControls]   = useState(true);
  const [nativeSourceIdx, setNativeSourceIdx] = useState(0); // cycles through native re-extractions
  const [bustCache,       setBustCache]       = useState(false); // append &bust=1 on retry
  const [subTracks,    setSubTracks]    = useState<SubtitleTrack[]>([]);
  const [activeSubIdx, setActiveSubIdx] = useState(-1);
  // Ref to VideoPlayer's internal handleSubtitleSelect — called when user picks sub
  const subSelectRef = useRef<((index: number, lang?: string) => void) | null>(null);

  // "native" = VideoPlayer + PlayerControls
  // "embed"  = StreamMoviePlayer + minimal floating bar
  const [playerMode, setPlayerMode] = useState<"native" | "embed">("native");

  const playerBoxRef     = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Source list for SourceSelector ───────────────────────────────────────
  // Index 0  → "Auto (Stream)" → VideoPlayer (Playwright extraction)
  // Index 1+ → iframe embeds  → StreamMoviePlayer
  // Must stay in sync with StreamMoviePlayer's internal buildSources() order
  const players = useMemo(() => {
    const m = isMuted ? 1 : 0;
    return [
      { title: "Auto (Stream)", source: `native:${movie.id}` },
      { title: "Videasy",       source: `https://player.videasy.net/movie/${movie.id}` },
      { title: "VidLink",       source: `https://vidlink.pro/movie/${movie.id}?autoplay=1&muted=${m}&player=jw&primaryColor=006fee` },
      { title: "VidSrc V3",     source: `https://vidsrc.cc/v3/embed/movie/${movie.id}?autoPlay=1&muted=${m}` },
      { title: "VidSrc V2",     source: `https://vidsrc.cc/v2/embed/movie/${movie.id}?autoPlay=1&muted=${m}` },
      { title: "NontonGo",      source: `https://www.nontongo.win/embed/movie/${movie.id}?autoplay=1&muted=${m}` },
      { title: "VidKing",       source: `https://www.vidking.net/embed/movie/${movie.id}?autoplay=1&muted=${m}` },
      { title: "MoviesAPI",     source: `https://moviesapi.club/movie/${movie.id}?autoplay=1` },
      { title: "2Embed",        source: `https://2embed.org/embed/movie/tmdb/${movie.id}` },
    ];
  }, [movie.id, isMuted]);

  // ── SourceSelector pick ───────────────────────────────────────────────────
  const handleSourceSelect = useCallback((index: number) => {
    setShowSources(false);
    setLoading(true);
    if (index === 0) {
      setPlayerMode("native");
      setForceSourceIdx(undefined);
      setSourceName("Loading…");
    } else {
      // Embed: StreamMoviePlayer is 0-indexed, SourceSelector offset by 1
      setPlayerMode("embed");
      setForceSourceIdx(index - 1);
      setSourceName(players[index]!.title);
    }
  }, [players]);

  // ── VideoPlayer fallback — retry with cache bust first, embed on second fail ──
  const handleNativeFallback = useCallback(() => {
    if (!bustCache) {
      // First failure: bust the cache and retry extraction
      console.warn("[MoviePlayer] Stream failed — retrying with cache bust…");
      setBustCache(true);
      setNativeSourceIdx(i => i + 1);
      setLoading(true);
      setSourceName("Retrying…");
    } else {
      // Second failure: give up and switch to iframe embeds
      console.warn("[MoviePlayer] Retry also failed → switching to iframe embeds");
      setPlayerMode("embed");
      setForceSourceIdx(undefined);
      setSourceName("Embed");
      setBustCache(false);
      setLoading(true);
    }
  }, [bustCache]);

  // ── Next Source (re-trigger native extraction with cache bust) ──────────────
  const handleNextSource = useCallback(() => {
    setLoading(true);
    setSourceName("Loading…");
    setNativeSourceIdx(i => i + 1); // changing this key forces VideoPlayer remount
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(async () => {
    const el = playerBoxRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { console.error("Fullscreen:", e); }
  }, []);

  useEffect(() => {
    const h = () => setIsZoomed(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Auto-hide controls ────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, []); // eslint-disable-line

  // ── Ad injection ──────────────────────────────────────────────────────────
  const {
    showAd, currentAd, adCountdown,
    onAdFinished, onAdReady,
    adSchedule, nextAdTime, showDebug,
  } = useAdInjection({
    currentTime:   watchTime,
    duration,
    movieData:     movie,
    onPauseMovie:  () => setPlaying(false),
    onResumeMovie: () => setPlaying(true),
  });

  // ── Watch-time ticker — only for embed mode (native fires onTimeUpdate) ───
  useEffect(() => {
    if (playerMode === "native") return;
    if (showAd || loading || !playing) return;
    const interval = setInterval(() => setWatchTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [showAd, loading, playing, playerMode]);

  // ── Shared player props ───────────────────────────────────────────────────
  const commonProps = {
    movieId:          movie.id,
    title:            movie.title,
    poster:           movie.poster_path,
    playing:          playing && !showAd,
    muted:            isMuted || showAd,
    zoomed:           isZoomed,
    seekTo,
    onSeekComplete:   () => setSeekTo(null),
    onLoadingChange:  setLoading,
    onTimeUpdate:     (s: number) => setWatchTime(s),
    onDurationChange: (s: number) => setDuration(s),
    onSourceReady:    (name: string) => { setSourceName(name); setLoading(false); },
  };

  return (
    <div
      ref={playerBoxRef}
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >

      {/* ── Mode 1: Native <video> via Playwright extraction ─────────────── */}
      {playerMode === "native" && (
        <VideoPlayer
          key={`native-${movie.id}-${nativeSourceIdx}`}
          {...commonProps}
          bustCache={bustCache}
          onFallback={handleNativeFallback}
          onSubTracksChange={setSubTracks}
          onSubActiveChange={setActiveSubIdx}
          onRegisterSubSelect={(fn) => { subSelectRef.current = fn; }}
        />
      )}

      {/* ── Mode 2: Iframe embed fallback ────────────────────────────────── */}
      {playerMode === "embed" && (
        <StreamMoviePlayer
          {...commonProps}
          forceSourceIndex={forceSourceIdx}
          onFallback={() => { setLoading(false); setSourceName("Failed"); }}
        />
      )}

      {/* ── PlayerControls — native mode only ───────────────────────────── */}
      {playerMode === "native" && !showAd && (
        <PlayerControls
          movie={movie}
          sourceName={sourceName}
          visible={showControls || loading}
          onOpenSources={() => setShowSources(true)}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((v) => !v)}
          isZoomed={isZoomed}
          onToggleZoom={handleToggleFullscreen}
          playing={playing}
          onTogglePlay={() => setPlaying((v) => !v)}
          currentTime={watchTime}
          duration={duration}
          loading={loading}
          onSeek={(s) => setSeekTo(s)}
          subTracks={subTracks}
          activeSubIdx={activeSubIdx}
          onSubSelect={(idx, lang) => {
            setActiveSubIdx(idx);
            subSelectRef.current?.(idx, lang);
          }}
        />
      )}

      {/* ── Next Source button — native mode, shown when env flag is set ─── */}
      {playerMode === "native" && SHOW_NEXT_SOURCE && !showAd && !loading && (
        <button
              type="button"
          onClick={handleNextSource}
          className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
          Next Source
        </button>
      )}

      {/* ── Embed mode: minimal floating bar (mute + fullscreen + source) ── */}
      {playerMode === "embed" && !showAd && (
        <div
          className={`
            absolute bottom-0 inset-x-0 z-20
            flex items-center justify-between
            px-4 pb-4 pt-10
            bg-gradient-to-t from-black/80 via-black/20 to-transparent
            transition-all duration-300
            ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}
          `}
        >
          {/* Mute + Fullscreen */}
          <div className="flex items-center gap-2">
            <button
              type="button"
          onClick={() => setIsMuted((v) => !v)}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-cyan-500 transition active:scale-90"
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </button>

            <button
              type="button"
          onClick={handleToggleFullscreen}
              aria-label={isZoomed ? "Exit fullscreen" : "Fullscreen"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-cyan-500 transition active:scale-90"
            >
              {isZoomed ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              )}
            </button>
          </div>

          {/* Source switcher */}
          <button
              type="button"
          onClick={() => setShowSources(true)}
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-cyan-500 hover:text-white transition active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M4.93 4.93a10 10 0 0 0 0 14.14M8.46 8.46a5 5 0 0 0 0 7.07"/>
            </svg>
            {sourceName}
          </button>
        </div>
      )}

      {/* ── Ad overlay — works in both modes ────────────────────────────── */}
      {showAd && currentAd && (
        <AdOverlayPlayer
          ad={currentAd}
          countdown={adCountdown}
          onFinished={onAdFinished}
          onAdReady={onAdReady}
        />
      )}

      {/* ── Debug panel ──────────────────────────────────────────────────── */}
      {process.env.NODE_ENV === "development" && showDebug && (
        <DebugPanel
          watchTime={watchTime}
          runtime={movie.runtime}
          nextAdTime={nextAdTime}
          adSchedule={adSchedule}
          currentAd={currentAd}
          showAd={showAd}
          playing={playing}
          loading={showAd ? false : loading}
          showDebug={showDebug}
        />
      )}

      {/* ── Source selector ──────────────────────────────────────────────── */}
      <SourceSelector
        open={showSources}
        players={players}
        selectedSource={playerMode === "native" ? 0 : (forceSourceIdx ?? 0) + 1}
        onSelect={handleSourceSelect}
        onClose={() => setShowSources(false)}
      />
    </div>
  );
}