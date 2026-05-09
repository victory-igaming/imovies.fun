"use client";

import {
  Settings,
  Play,
  Pause,
  Maximize,
  Volume2,
} from "lucide-react";

interface Props {
  movie: any;

  sourceName: string;

  onOpenSources: () => void;

  playing?: boolean;

  onTogglePlay?: () => void;
}

export default function PlayerControls({
  movie,
  sourceName,
  onOpenSources,
  playing = true,
  onTogglePlay,
}: Props) {
  return (
    <>
      {/* TOP CONTROLS */}
      <div
        className="
          absolute
          left-0
          right-0
          top-0
          z-30
          flex
          items-center
          justify-between
          bg-gradient-to-b
          from-black/90
          via-black/40
          to-transparent
          p-6
        "
      >
        {/* TITLE */}
        <div>
          <h2
            className="
              text-2xl
              font-black
              md:text-4xl
            "
          >
            {movie.title}
          </h2>

          <div
            className="
              mt-2
              flex
              items-center
              gap-3
              text-sm
              text-gray-400
            "
          >
            <span>
              {movie.release_date?.split(
                "-"
              )[0]}
            </span>

            <span>•</span>

            <span>
              {movie.runtime}m
            </span>

            <span>•</span>

            <span>
              {sourceName}
            </span>
          </div>
        </div>

        {/* SOURCE BUTTON */}
        <button
          onClick={onOpenSources}
          className="
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-full
            bg-black/60
            backdrop-blur-xl
            transition
            hover:bg-cyan-400
            hover:text-black
          "
          title="Sources"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* BOTTOM CONTROLS */}
      <div
        className="
          absolute
          bottom-0
          left-0
          right-0
          z-30
          flex
          items-center
          justify-between
          bg-gradient-to-t
          from-black/90
          via-black/40
          to-transparent
          p-6
        "
      >
        {/* LEFT */}
        <div className="flex items-center gap-4">
          {/* PLAY/PAUSE */}
          <button
            onClick={onTogglePlay}
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-full
              bg-cyan-400
              text-black
              transition
              hover:scale-110
            "
          >
            {playing ? (
              <Pause size={24} />
            ) : (
              <Play size={24} />
            )}
          </button>

          {/* VOLUME */}
          <button
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-black/60
              backdrop-blur-xl
              transition
              hover:bg-white/10
            "
            title="Volume"
          >
            <Volume2 size={22} />
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {/* FULLSCREEN */}
          <button
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-black/60
              backdrop-blur-xl
              transition
              hover:bg-white/10
            "
            title="Fullscreen"
          >
            <Maximize size={22} />
          </button>
        </div>
      </div>
    </>
  );
}
