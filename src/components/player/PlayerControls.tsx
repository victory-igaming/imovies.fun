"use client";

import {
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react";

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

function formatTime(seconds: number = 0) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return `${min}:${String(sec).padStart(2, "0")}`;
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
    duration > 0 ? (currentTime / duration) * 100 : 0;

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = Number(e.target.value);
  onSeek?.(value);
};

  return (
    <>
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent p-6">
        <div>
          <p className="text-sm text-gray-300">
            {sourceName}
          </p>
        </div>

        <button
          onClick={onOpenSources}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-cyan-400 hover:text-black"
          title="Sources"
        >
          <Settings size={22} />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6">
        {/* TIME + PROGRESS */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-300">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{
                width: `${Math.min(progress, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onTogglePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-black transition hover:scale-110"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <button
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-white/10"
              title="Volume"
              onClick={onToggleMute}
            >
              {isMuted ? (
                <VolumeX size={20} className="text-red-400" />
              ) : (
                <Volume2 size={20} className="text-green-400" />
              )}
            </button>
          </div>

          <button
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl transition hover:bg-white/10"
            title="Fullscreen"
            onClick={onToggleZoom}
          >
            <Maximize
              size={20}
              className={isZoomed ? "text-cyan-400" : "text-white"}
            />
          </button>
        </div>
      </div>
    </>
  );
}