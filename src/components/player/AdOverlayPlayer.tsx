"use client";

import { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Loader2 } from "lucide-react";

interface Props {
  ad: any;
  countdown: number;
  onFinished: () => void;
  onAdReady: () => void;
}

export default function AdOverlayPlayer({
  ad,
  countdown,
  onFinished,
  onAdReady,
}: Props) {
  const finishedRef = useRef(false);
  const readyRef = useRef(false);

  const [ready, setReady] = useState(false);

  const finishAd = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  };

  const markReady = () => {
    if (readyRef.current) return;

    readyRef.current = true;
    setReady(true);
    onAdReady();
  };

  useEffect(() => {
    finishedRef.current = false;
    readyRef.current = false;
    setReady(false);

    const fallback = setTimeout(() => {
      markReady();
    }, 2000);

    return () => clearTimeout(fallback);
  }, [ad?.id, ad?.videoUrl]);

  useEffect(() => {
    if (countdown <= 0) {
      finishAd();
    }
  }, [countdown]);

  if (!ad || finishedRef.current) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 bg-black">
      {!ready && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black">
          <Loader2 size={56} className="animate-spin text-cyan-400" />

          <p className="mt-4 text-sm text-gray-400">
            Loading advertisement...
          </p>
        </div>
      )}

      <ReactPlayer
        key={`${ad.id}-${ad.videoUrl}`}
        url={ad.videoUrl}
        playing={true}
        controls={false}
        muted={false}
        volume={1}
        width="100%"
        height="100%"
        playsinline
        onReady={markReady}
        onStart={markReady}
        onPlay={markReady}
        onEnded={finishAd}
        onError={finishAd}
        className="absolute inset-0"
        config={{
          file: {
            attributes: {
              playsInline: true,
              preload: "auto",
            },
          },
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-6 pointer-events-none">
        <div className="rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl">
          Sponsored Ad
        </div>

        <div className="rounded-full bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-xl">
          Ad ends in {countdown}s
        </div>
      </div>

      <div className="absolute bottom-10 left-10 pointer-events-none">
        <h2 className="text-4xl font-black text-white">
          {ad.title}
        </h2>
      </div>
    </div>
  );
}