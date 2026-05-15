"use client";

import { useEffect, useMemo, useState } from "react";

import useAdInjection from "@/hooks/useAdInjection";

import VideoPlayer from "./VideoPlayer";

import PlayerControls from "./PlayerControls";

import AdOverlayPlayer from "./AdOverlayPlayer";

import SourceSelector from "./SourceSelector";

import DebugPanel from "./DebugPanel";

interface Props {
  movie: any;
}

export default function MoviePlayer({ movie }: Props) {
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [watchTime, setWatchTime] = useState(0);

  const [isMuted, setIsMuted] = useState(false); 
  const [isZoomed, setIsZoomed] = useState(false); 
  const [selectedSource, setSelectedSource] = useState(0);

  const [showSources, setShowSources] = useState(false);
  const [isIframeActive, setIsIframeActive] = useState(true);
  const [startAt, setStartAt] = useState(0);
  const players = useMemo(
    () => [
     
    {
      title: "VidSrc 4",
      source: `https://vidsrc.cc/v2/embed/movie/${movie.id}?autoPlay=true&muted=${isMuted ? 1 : 0}`,
    
    },
      {
        title: "VidSrc 5",
        source: `https://vidsrc.cc/v3/embed/movie/${movie.id}?autoPlay=true&muted=${isMuted ? 1 : 0}`,
      },

       {
        title: "MoviesAPI",
        source: `https://moviesapi.club/movie/${movie.id}?autoplay=1&muted=${isMuted ? 1 : 0}`,
      },

      {
        title: "VidLink",
        source: `https://vidlink.pro/movie/${movie.id}?autoplay=1&muted=${isMuted ? 1 : 0}&player=jw&primaryColor=006fee&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false&startAt=${startAt}`,
      },

      {
        title: "VidLink 2",
        source: `https://vidlink.pro/movie/${movie.id}?autoplay=1&muted=${isMuted ? 1 : 0}&primaryColor=006fee&autoplay=false&startAt=${startAt}`,
      },

      {
        title: "VidKing",
        source: `https://www.vidking.net/embed/movie/${movie.id}?autoplay=1&muted=${isMuted ? 1 : 0}&color=006fee&startAt=${startAt}`,
      },

      {
        title: "NontonGo",
        source: `https://www.nontongo.win/embed/movie/${movie.id}?autoplay=1&muted=${isMuted ? 1 : 0}&startAt=${startAt}`,
      },
    ],
    [movie.id, isMuted, isZoomed,startAt],
  );

  const PLAYER = players[selectedSource];

  /* ADS */
  const {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
    adSchedule,
    nextAdTime,
    showDebug,
  } = useAdInjection({
    currentTime: watchTime,
    duration: movie.runtime * 60,
    movieData: movie, 
    onPauseMovie: () => setPlaying(false),
    onResumeMovie: () => setPlaying(true),
  
  });

  /* WATCH TIMER */
  useEffect(() => {
    if (showAd || loading || !playing || !isIframeActive) {
      return;
    }

    const interval = setInterval(() => {
      setWatchTime((prev) => prev + 1);
      setStartAt(watchTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [showAd, loading, playing, isIframeActive]);

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
        setIsIframeActive={setIsIframeActive}
        isZoomed={isZoomed}
      />

      {/* <PlayerControls
        movie={movie}
        sourceName={PLAYER.title}
        onOpenSources={() => setShowSources(true)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        isZoomed={isZoomed}
        onToggleZoom={() => setIsZoomed(!isZoomed)}
        playing={playing}
        onTogglePlay={() => setPlaying(!playing)}
      /> */}

      {showAd && currentAd && (
        <AdOverlayPlayer
          ad={currentAd}
          countdown={adCountdown}
          onFinished={onAdFinished}
        />
      )}

      {showDebug && (
      <DebugPanel
        watchTime={watchTime}
        runtime={movie.runtime}
        nextAdTime={nextAdTime}
        adSchedule={adSchedule}
        currentAd={currentAd}
        showAd={showAd}
        playing={playing}
        loading={loading}
        showDebug={showDebug}
      />  )}

      <SourceSelector
        open={showSources}
        players={players}
        selectedSource={selectedSource}
        onSelect={(index) => {
          setSelectedSource(index);

          setLoading(true);

          setShowSources(false);
        }}
      />
    </div>
  );
}
