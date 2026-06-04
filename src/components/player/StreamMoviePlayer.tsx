"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, ChevronRight } from "lucide-react";
import { getEmbedSources } from "@/lib/streamSources";

interface Props {
  movieId: string | number;
  title: string;
  poster?: string;
  playing: boolean;
  muted: boolean;
  zoomed: boolean;
  startAt?: number;
  seekTo?: number | null;
  onSeekComplete?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onSourceReady?: (sourceName: string) => void;
  onFallback?: () => void;
  /** Called whenever the active source index changes (0-based within this component) */
  onSourceChange?: (index: number) => void;
  /** Pass an index to force-jump to a specific source (e.g. from SourceSelector) */
  forceSourceIndex?: number;
}

const LOAD_TIMEOUT_MS = 14_000;

type Phase = "loading" | "playing" | "error";

export default function StreamMoviePlayer({
  movieId,
  poster,
  muted,
  zoomed,
  forceSourceIndex,
  onLoadingChange,
  onSourceReady,
  onFallback,
  onSourceChange,
}: Props) {
  const sources = useMemo(() => getEmbedSources(movieId, muted), [movieId, muted]);

  const [idx,    setIdx]    = useState(0);
  const [phase,  setPhase]  = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");

  const mountedRef   = useRef(true);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedIdxRef = useRef(-1);

  const clearTimer = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  // Notify parent whenever the active source index changes
  useEffect(() => {
    onSourceChange?.(idx);
  }, [idx]); // eslint-disable-line

  // ── Force source from parent (SourceSelector pick) ───────────────────────
  useEffect(() => {
    if (forceSourceIndex == null) return;
    clearTimer();
    loadedIdxRef.current = -1;
    setIdx(forceSourceIndex);
    setPhase("loading");
    setErrMsg("");
    onLoadingChange?.(true);
  }, [forceSourceIndex]); // eslint-disable-line

  // ── Auto-advance when source fails / times out ────────────────────────────
  const tryNext = useCallback((fromIdx: number) => {
    clearTimer();
    const next = fromIdx + 1;
    if (!mountedRef.current) return;
    if (next >= sources.length) {
      setErrMsg("All stream sources failed. Please try again.");
      setPhase("error");
      onLoadingChange?.(false);
      onFallback?.();
      return;
    }
    loadedIdxRef.current = -1;
    setIdx(next);
    setPhase("loading");
    onLoadingChange?.(true);
  }, [sources, onLoadingChange, onFallback]);

  // ── Start timeout whenever idx changes ────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const currentIdx = idx;

    clearTimer();
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current || loadedIdxRef.current === currentIdx) return;
      tryNext(currentIdx);
    }, LOAD_TIMEOUT_MS);

    return clearTimer;
  }, [idx]); // eslint-disable-line

  useEffect(() => () => { mountedRef.current = false; clearTimer(); }, []);

  // ── iframe onLoad ─────────────────────────────────────────────────────────
  const handleLoad = useCallback(() => {
    const currentIdx = idx;
    if (!mountedRef.current || loadedIdxRef.current === currentIdx) return;
    loadedIdxRef.current = currentIdx;
    clearTimer();
    setTimeout(() => {
      if (!mountedRef.current) return;
      setPhase("playing");
      onLoadingChange?.(false);
      onSourceReady?.(sources[currentIdx]?.name ?? "Stream");
    }, 1200);
  }, [idx, sources, onLoadingChange, onSourceReady]);

  const handleRetry = useCallback(() => {
    clearTimer();
    loadedIdxRef.current = -1;
    setIdx(0);
    setPhase("loading");
    setErrMsg("");
    onLoadingChange?.(true);
  }, [onLoadingChange]);

  const currentSrc = sources[idx];

  return (
    <div className="relative aspect-video overflow-hidden bg-black">

      {/* Iframe */}
      {currentSrc && (
        <iframe
          key={`${movieId}-${idx}`}
          src={currentSrc.url}
          className={`absolute inset-0 h-full w-full border-0 transition-transform duration-500 ${
            zoomed ? "scale-125" : "scale-100"
          }`}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={handleLoad}
        />
      )}

      {/* Loading overlay */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black pointer-events-none">
          <img src="/logos/logo.png" alt="Logo" className="mb-6 w-28 animate-pulse" />
          <Loader2 size={58} className="animate-spin text-cyan-400" />
          <p className="mt-5 text-sm text-gray-400">
            {idx === 0 ? "Loading stream…" : `Trying source ${idx + 1} of ${sources.length}…`}
          </p>
        </div>
      )}

      {/* Error screen */}
      {phase === "error" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black text-center px-6">
          <img src="/logos/logo.png" alt="Logo" className="mb-6 w-28 opacity-80" />
          <p className="mb-5 max-w-sm text-sm text-red-400">{errMsg}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 font-bold text-white shadow-[0_0_30px_rgba(34,211,238,0.35)] transition hover:scale-105 active:scale-95"
          >
            <RotateCcw size={18} /> Retry All Sources
          </button>
        </div>
      )}

      {/* Dev label */}
      {process.env.NODE_ENV === "development" && phase === "playing" && (
        <div className="absolute bottom-16 left-4 z-20 rounded bg-black/60 px-2 py-1 text-[10px] font-mono text-cyan-400 pointer-events-none">
          {currentSrc?.name} [{idx + 1}/{sources.length}]
        </div>
      )}
    </div>
  );
}