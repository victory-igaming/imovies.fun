"use client";

import {
  Play,
  Pause,
  Maximize,
  Minimize2,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react";
import { useRef } from "react";

interface Props {
  movie: any;
  sourceName: string;
  onOpenSources: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isZoomed?: boolean;
  onToggleZoom?: () => void;
  playing?: boolean;
  onTogglePlay?: () => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (seconds: number) => void;
}

function formatTime(s = 0) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PlayerControls({
  movie,
  sourceName,
  onOpenSources,
  isMuted,
  onToggleMute,
  isZoomed,
  onToggleZoom,
  playing = true,
  onTogglePlay,
  currentTime = 0,
  duration = 0,
  onSeek,
}: Props) {
  const progress =
    duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek?.(Math.floor(frac * duration));
  };

  const seekFromPointer = (clientX: number) => {
    if (!trackRef.current || duration <= 0) return;

    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);

    onSeek?.(Math.floor(frac * duration));
  };

  const handleSeekStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e.clientX);
  };

  const handleSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.pointerType === "mouse") return;
    seekFromPointer(e.clientX);
  };

  return (
    <>
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent p-6">
        <p className="text-sm text-gray-300">{sourceName}</p>
        <button
          onClick={onOpenSources}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-cyan-400 hover:text-black"
          title="Sources"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6">
        {/* Progress bar — clickable */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onPointerDown={handleSeekStart}
          onPointerMove={handleSeekMove}
          className="group relative h-3 w-full cursor-pointer touch-none overflow-hidden rounded-full bg-white/20"
          title="Seek"
        >
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />

          <div
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-cyan-400 shadow-lg transition-all"
            style={{ left: `calc(${progress}% - 10px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-black transition hover:scale-110"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Mute */}
            <button
              onClick={onToggleMute}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-white/10"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX size={20} className="text-red-400" />
              ) : (
                <Volume2 size={20} className="text-green-400" />
              )}
            </button>

            {/* Time display */}
            {duration > 0 && (
              <span className="hidden text-xs text-gray-400 sm:block">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}
          </div>

          {/* Zoom / fullscreen */}
          <button
            onClick={onToggleZoom}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-white/10"
            title={isZoomed ? "Zoom out" : "Zoom in"}
          >
            {isZoomed ? (
              <Minimize2 size={20} className="text-cyan-400" />
            ) : (
              <Maximize size={20} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
