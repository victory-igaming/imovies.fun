"use client";

import { useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX,
  Maximize2, Minimize2, Settings, Loader2,
} from "lucide-react";
import SubtitleSelector, { type SubtitleTrack } from "@/components/player/SubtitleSelector";

interface Props {
  movie:          any;
  sourceName:     string;
  visible:        boolean;
  playing:        boolean;
  isMuted:        boolean;
  isZoomed:       boolean;
  loading:        boolean;
  currentTime:    number;
  duration:       number;
  onTogglePlay:   () => void;
  onToggleMute:   () => void;
  onToggleZoom:   () => void;
  onOpenSources:  () => void;
  onSeek:         (seconds: number) => void;
  // Subtitle props — optional so existing callers don't break
  subTracks?:     SubtitleTrack[];
  activeSubIdx?:  number;
  onSubSelect?:   (index: number, lang?: string) => void;
}

function fmt(s: number) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PlayerControls({
  movie, sourceName, visible, playing, isMuted,
  isZoomed, loading, currentTime, duration,
  onTogglePlay, onToggleMute, onToggleZoom, onOpenSources, onSeek,
  subTracks   = [],
  activeSubIdx = -1,
  onSubSelect,
}: Props) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect  = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      onSeek(Math.floor(ratio * duration));
    },
    [duration, onSeek],
  );

  return (
    <div
      className={`
        absolute inset-x-0 bottom-0 z-20
        transition-all duration-300 ease-in-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}
      `}
    >
      {/* Gradient fog */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none rounded-b-[32px]" />

      <div className="relative px-5 pb-5 pt-10 flex flex-col gap-3">

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        <div
          className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 hover:h-2.5 transition-all duration-150"
          onClick={handleSeekClick}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        {/* ── Bottom row ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">

          {/* Left: play + mute + time */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-cyan-500 transition active:scale-90"
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : playing
                  ? <Pause size={18} />
                  : <Play  size={18} className="translate-x-0.5" />
              }
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-cyan-500 transition active:scale-90"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <span className="text-xs font-mono text-gray-300 select-none tabular-nums">
              {fmt(currentTime)}
              <span className="mx-1 text-gray-500">/</span>
              {fmt(duration)}
            </span>
          </div>

          {/* Centre: movie title */}
          <p className="hidden md:block max-w-[30%] truncate text-center text-xs font-semibold text-white/70 select-none">
            {movie.title}
          </p>

          {/* Right: subtitles + source + fullscreen */}
          <div className="flex items-center gap-2">

            {/* Subtitle selector — always shown in native mode */}
            {onSubSelect && (
              <SubtitleSelector
                tracks={subTracks}
                activeIndex={activeSubIdx}
                onSelect={onSubSelect}
                movieId={movie?.id}
              />
            )}

            {/* Source selector */}
            <button
              type="button"
              onClick={onOpenSources}
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-cyan-500 hover:text-white transition active:scale-90"
            >
              <Settings size={13} />
              {sourceName}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={onToggleZoom}
              aria-label={isZoomed ? "Exit fullscreen" : "Fullscreen"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-cyan-500 transition active:scale-90"
            >
              {isZoomed ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}