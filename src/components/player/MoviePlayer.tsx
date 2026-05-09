
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import useAdInjection from "@/hooks/useAdInjection";

import VideoPlayer from "./VideoPlayer";

import PlayerControls from "./PlayerControls";

import AdOverlayPlayer from "./AdOverlayPlayer";

import SourceSelector from "./SourceSelector";

import DebugPanel from "./DebugPanel";

interface Props {
  movie: any;
}

export default function MoviePlayer({
  movie,
}: Props) {
  const [loading, setLoading] =
    useState(true);

  const [playing, setPlaying] =
    useState(true);

  const [watchTime, setWatchTime] =
    useState(0);

  const [selectedSource, setSelectedSource] =
    useState(0);

  const [showSources, setShowSources] =
    useState(false);

  const players = useMemo(
    () => [
      {
        title: "VidLink",
        source: `https://vidlink.pro/movie/${movie.id}`,
      },

      {
        title: "Embed.su",
        source: `https://embed.su/embed/movie/${movie.id}`,
      },
    ],
    [movie.id]
  );

  const PLAYER =
    players[selectedSource];

  /* ADS */
  const {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
    adSchedule,
    nextAdTime,
  } = useAdInjection({
    currentTime: watchTime,

    duration:
      movie.runtime * 60,

    onPauseMovie: () =>
      setPlaying(false),

    onResumeMovie: () =>
      setPlaying(true),
  });

  /* WATCH TIMER */
  useEffect(() => {
    if (showAd || loading) return;

    const interval = setInterval(() => {
      setWatchTime(
        (prev) => prev + 1
      );
    }, 1000);

    return () =>
      clearInterval(interval);
  }, [showAd, loading]);

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-[32px]
        border
        border-white/10
        bg-black
      "
    >
      <VideoPlayer
        source={PLAYER.source}
        loading={loading}
        setLoading={setLoading}
        setPlaying={setPlaying}
      />

      <PlayerControls
        movie={movie}
        sourceName={PLAYER.title}
        onOpenSources={() =>
          setShowSources(true)
        }
      />

      {showAd && currentAd && (
        <AdOverlayPlayer
          ad={currentAd}
          countdown={adCountdown}
          onFinished={onAdFinished}
        />
      )}

      <DebugPanel
        watchTime={watchTime}
        runtime={movie.runtime}
        nextAdTime={nextAdTime}
        adSchedule={adSchedule}
        currentAd={currentAd}
        showAd={showAd}
      />

      <SourceSelector
        open={showSources}
        players={players}
        selectedSource={
          selectedSource
        }
        onSelect={(index) => {
          setSelectedSource(index);

          setLoading(true);

          setShowSources(false);
        }}
      />
    </div>
  );
}
