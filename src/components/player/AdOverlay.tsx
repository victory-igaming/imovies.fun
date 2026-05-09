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
        absolute
        inset-0
        z-50
        bg-black
      "
    >
      <ReactPlayer
        url={ad.videoUrl}
        playing
        controls={false}
        width="100%"
        height="100%"
        onEnded={onFinished}
      />

      {/* AD INFO */}
      <div
        className="
          absolute
          top-4
          right-4
          rounded-full
          bg-black/70
          px-4
          py-2
          text-sm
          font-semibold
          backdrop-blur-xl
        "
      >
        Ad ends in {countdown}s
      </div>

      {/* SPONSORED */}
      <div
        className="
          absolute
          top-4
          left-4
          rounded-full
          bg-yellow-500
          px-4
          py-2
          text-sm
          font-bold
          text-black
        "
      >
        Sponsored
      </div>
    </div>
  );
}