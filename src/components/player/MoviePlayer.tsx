"use client";

import { useEffect, useRef, useState } from "react";

import ReactPlayer from "react-player";

import {
  Volume2,
  Maximize,
  Loader2,
} from "lucide-react";

import AdOverlay from "./AdOverlay";

import useAdInjection from "@/hooks/useAdInjection";

interface Props {
  movie: any;
}

export default function MoviePlayer({
  movie,
}: Props) {
  const playerRef = useRef<ReactPlayer>(null);

  const [playing, setPlaying] = useState(true);

  const [playedSeconds, setPlayedSeconds] =
    useState(0);

  const [duration, setDuration] = useState(0);

  const [loading, setLoading] = useState(true);

  const [showControls, setShowControls] =
    useState(true);

  const STORAGE_KEY = `movie-progress-${movie.id}`;

  /* LOAD SAVED PLAYBACK */
  useEffect(() => {
    const savedTime =
      localStorage.getItem(STORAGE_KEY);

    if (savedTime) {
      setPlayedSeconds(Number(savedTime));
    }
  }, [STORAGE_KEY]);

  /* SAVE PLAYBACK */
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(
        STORAGE_KEY,
        String(playedSeconds)
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [playedSeconds, STORAGE_KEY]);

  /* AD INJECTION SYSTEM */
  const {
    currentAd,
    showAd,
    adCountdown,
    onAdFinished,
  } = useAdInjection({
    currentTime: playedSeconds,
    onPauseMovie: () => setPlaying(false),
    onResumeMovie: () => setPlaying(true),
  });

  /* SEEK TO SAVED POSITION */
  const handleReady = () => {
    if (
      playedSeconds > 0 &&
      playerRef.current
    ) {
      playerRef.current.seekTo(
        playedSeconds,
        "seconds"
      );
    }

    setLoading(false);
  };

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-[32px]
        border
        border-white/10
        bg-black
        shadow-[0_0_40px_rgba(0,0,0,0.4)]
      "
    >
      {/* PLAYER */}
      <div className="relative aspect-video">
        {/* LOADING */}
        {loading && (
          <div
            className="
              absolute
              inset-0
              z-30
              flex
              items-center
              justify-center
              bg-black
            "
          >
            <Loader2
              className="animate-spin text-cyan-400"
              size={50}
            />
          </div>
        )}

        {/* MOVIE PLAYER */}
        <ReactPlayer
          ref={playerRef}
          url={movie.videoUrl}
          width="100%"
          height="100%"
          playing={playing && !showAd}
          controls={!showAd}
          volume={1}
          muted={false}
          pip={false}
          onReady={handleReady}
          onBuffer={() => setLoading(true)}
          onBufferEnd={() => setLoading(false)}
          onDuration={(dur) => setDuration(dur)}
          onProgress={(progress) => {
            setPlayedSeconds(
              progress.playedSeconds
            );
          }}
          config={{
            file: {
              attributes: {
                controlsList:
                  "nodownload noplaybackrate",
                disablePictureInPicture: true,
              },
            },
          }}
          className="absolute inset-0"
        />

        {/* AD OVERLAY */}
        {showAd && currentAd && (
          <AdOverlay
            ad={currentAd}
            countdown={adCountdown}
            onFinished={onAdFinished}
          />
        )}

        {/* TOP CONTROLS */}
        <div
          className="
            absolute
            top-4
            left-4
            right-4
            z-20
            flex
            items-center
            justify-between
            pointer-events-none
          "
        >
          {/* LIVE BADGE */}
          <div
            className="
              flex
              items-center
              gap-2
              rounded-full
              bg-red-500/90
              px-4
              py-2
              text-sm
              font-bold
              backdrop-blur-xl
            "
          >
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />

            LIVE
          </div>

          {/* QUALITY */}
          <div
            className="
              rounded-full
              bg-black/60
              px-4
              py-2
              text-sm
              backdrop-blur-xl
            "
          >
            4K Ultra HD
          </div>
        </div>

        {/* BOTTOM CONTROLS */}
        <div
          className="
            absolute
            bottom-4
            left-4
            right-4
            z-20
            flex
            items-center
            justify-between
            pointer-events-none
          "
        >
          {/* TIME */}
          <div
            className="
              rounded-full
              bg-black/60
              px-4
              py-2
              text-sm
              backdrop-blur-xl
            "
          >
            {Math.floor(playedSeconds / 60)}:
            {String(
              Math.floor(playedSeconds % 60)
            ).padStart(2, "0")}
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3">
            <button
              className="
                pointer-events-auto
                flex
                items-center
                justify-center
                w-12
                h-12
                rounded-full
                bg-black/60
                backdrop-blur-xl
                hover:bg-black/80
                transition
              "
            >
              <Volume2 size={20} />
            </button>

            <button
              className="
                pointer-events-auto
                flex
                items-center
                justify-center
                w-12
                h-12
                rounded-full
                bg-black/60
                backdrop-blur-xl
                hover:bg-black/80
                transition
              "
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}