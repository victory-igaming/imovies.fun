"use client";

import ReactPlayer from "react-player";

interface Props {
  ad: any;

  countdown: number;

  onFinished: () => void;
}

export default function AdOverlayPlayer({
  ad,
  countdown,
  onFinished,
}: Props) {
  return (
    <div
      className="
        absolute
        inset-0
        z-50
        bg-black
      "
    >
      {/* AD VIDEO */}
      <ReactPlayer
        url={ad.videoUrl}
        playing={countdown > 0}
        controls={false}
        muted={countdown <= 0}
        width="100%"
        height="100%"
        onEnded={onFinished}
        className="absolute inset-0"
      />

      {/* DARK OVERLAY */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-black/70
          via-transparent
          to-black/30
        "
      />

      {/* TOP BAR */}
      <div
        className="
          absolute
          left-0
          right-0
          top-0
          flex
          items-center
          justify-between
          p-6
        "
      >
        {/* SPONSORED */}
        <div
          className="
            rounded-full
            bg-black/70
            px-4
            py-2
            text-sm
            font-semibold
            text-white
            backdrop-blur-xl
          "
        >
          Sponsored Ad
        </div>

        {/* COUNTDOWN */}
        <div
          className="
            rounded-full
            bg-black/70
            px-4
            py-2
            text-sm
            text-white
            backdrop-blur-xl
          "
        >
          Ad ends in {countdown}s
        </div>
      </div>

      {/* AD TITLE */}
      <div
        className="
          absolute
          bottom-10
          left-10
        "
      >
        <h2
          className="
            text-4xl
            font-black
            text-white
          "
        >
          {ad.title}
        </h2>
      </div>
    </div>
  );
}
