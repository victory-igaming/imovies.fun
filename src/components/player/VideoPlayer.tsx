"use client";

import { Loader2 } from "lucide-react";

interface Props {
  source: string;

  loading: boolean;

  setLoading: (
    value: boolean
  ) => void;

  setPlaying: (
    value: boolean
  ) => void;
}

export default function VideoPlayer({
  source,
  loading,
  setLoading,
  setPlaying,
}: Props) {
  return (
    <div className="relative aspect-video">
      {/* LOADING SCREEN */}
      {loading && (
        <div
          className="
            absolute
            inset-0
            z-40
            flex
            flex-col
            items-center
            justify-center
            bg-black
          "
        >
          <img
            src="/logos/logo.png"
            alt="iMovies"
            className="
              mb-6
              w-28
              animate-pulse
            "
          />

          <Loader2
            className="
              animate-spin
              text-cyan-400
            "
            size={60}
          />

          <p className="mt-6 text-gray-400">
            Loading cinematic
            experience...
          </p>
        </div>
      )}

      {/* VIDEO IFRAME */}
      <iframe
        src={source}
        allowFullScreen
        allow="autoplay; fullscreen"
        className="
          absolute
          inset-0
          h-full
          w-full
          border-0
        "
        onLoad={() => {
          setLoading(false);

          setPlaying(true);
        }}
      />
    </div>
  );
}

