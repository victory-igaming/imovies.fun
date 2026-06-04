"use client";

import ReactPlayer from "react-player";

interface Props {
  ad: any;

  countdown: number;

  onFinished: () => void;
}

export default function AdOverlay({
  ad,
  countdown,
  onFinished,
}: Props) {
  return (
    <div
      className="
        absolute inset-0 z-[9999] bg-black w-full h-full        
      "
    >
      {/* VIDEO */}
      <ReactPlayer
        url={ad.videoUrl}
        playing
        controls={false}
        muted={false}
        width="100%"
        height="100%"
        onEnded={onFinished}
        className="absolute inset-0"
      />

      {/* OVERLAY */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-black/60
          via-transparent
          to-black/20
          pointer-events-none
        "
      />

      {/* TOP BAR */}
      <div
        className="
          absolute
          top-4
          left-4
          right-4
          flex
          items-center
          justify-between
        "
      >
        <div
          className="
            rounded-full
            bg-black/70
            px-4
            py-2
            text-sm
            font-bold
            backdrop-blur-xl
          "
        >
          Sponsored Ad
        </div>

        <div
          className="
            rounded-full
            bg-black/70
            px-4
            py-2
            text-sm
            backdrop-blur-xl
          "
        >
          Skip in {countdown}s
        </div>
      </div>
    </div>
  );
}
