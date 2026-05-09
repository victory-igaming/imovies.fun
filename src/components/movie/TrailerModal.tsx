"use client";

import {
  X,
  Play,
} from "lucide-react";

interface Props {
  open: boolean;

  onClose: () => void;

  trailerKey?: string;

  title?: string;
}

export default function TrailerModal({
  open,
  onClose,
  trailerKey,
  title,
}: Props) {
  if (!open || !trailerKey)
    return null;

  return (
    <div
      className="
        fixed
        inset-0
        z-[200]
        flex
        items-center
        justify-center
        bg-black/80
        p-6
        backdrop-blur-xl
      "
    >
      {/* BACKDROP */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* MODAL */}
      <div
        className="
          relative
          w-full
          max-w-6xl
          overflow-hidden
          rounded-[32px]
          border
          border-white/10
          bg-[#0B1120]
          shadow-2xl
        "
      >
        {/* HEADER */}
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-white/10
            p-5
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-red-500
              "
            >
              <Play
                size={22}
                fill="white"
              />
            </div>

            <div>
              <h2
                className="
                  text-2xl
                  font-black
                "
              >
                Official Trailer
              </h2>

              <p className="text-sm text-gray-400">
                {title}
              </p>
            </div>
          </div>

          {/* CLOSE */}
          <button
            onClick={onClose}
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-white/5
              transition
              hover:bg-red-500
            "
          >
            <X size={24} />
          </button>
        </div>

        {/* VIDEO */}
        <div className="relative aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="
              absolute
              inset-0
              h-full
              w-full
            "
          />
        </div>
      </div>
    </div>
  );
}
