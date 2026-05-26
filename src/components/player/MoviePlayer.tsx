"use client";

import {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import useAdInjection from "@/hooks/useAdInjection";

import VideoPlayer from "./VideoPlayer";
import StreamMoviePlayer from "../StreamMoviePlayer";
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

  const [useFallbackPlayer, setUseFallbackPlayer] = useState(false);
  const [sourceName, setSourceName] = useState("Stream");

  const playerBoxRef = useRef<HTMLDivElement>(null);
  const [seekTo, setSeekTo] = useState<number | null>(null);

  const players = useMemo(
  () => [
    {
      title: "VidSrc V2",
      source: `https://vidsrc.cc/v2/embed/movie/${movie.id}?autoPlay=1&muted=${
        isMuted ? 1 : 0
      }`,
    },

    {
      title: "VidSrc V3",
      source: `https://vidsrc.cc/v3/embed/movie/${movie.id}?autoPlay=1&muted=${
        isMuted ? 1 : 0
      }`,
    },

    {
      title: "VidLink",
      source: `https://vidlink.pro/movie/${movie.id}?autoplay=1&muted=${
        isMuted ? 1 : 0
      }&player=jw`,
    },

    {
      title: "VidKing",
      source: `https://www.vidking.net/embed/movie/${movie.id}?autoplay=1&muted=${
        isMuted ? 1 : 0
      }`,
    },
  ],
  [movie.id, isMuted]
);

  const PLAYER = players[selectedSource];

  const handleFallback = useCallback(() => {
    setUseFallbackPlayer(true);
    setSourceName(PLAYER.title);
    setLoading(true);
  }, [PLAYER.title]);

  const handleSourceReady = useCallback((name: string) => {
    setSourceName(name);
    setLoading(false);
  }, []);

  const handleToggleFullscreen = async () => {
    const element = playerBoxRef.current;

    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
        setIsZoomed(true);
      } else {
        await document.exitFullscreen();
        setIsZoomed(false);
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsZoomed(Boolean(document.fullscreenElement));
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  const {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
    onAdReady,
    adSchedule,
    nextAdTime,
    showDebug,
  } = useAdInjection({
    currentTime: watchTime,
    duration: (movie.runtime || 120) * 60,
    movieData: movie,

    onPauseMovie: () => {
      setPlaying(false);
    },

    onResumeMovie: () => {
      setPlaying(true);
    },
  });

  useEffect(() => {
    if (showAd || loading || !playing || !isIframeActive) return;

    const interval = setInterval(() => {
      setWatchTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [showAd, loading, playing, isIframeActive]);

  return (
    <div
      ref={playerBoxRef}
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black"
    >
      {!useFallbackPlayer ? (
        <StreamMoviePlayer
          movieId={movie.id}
          title={movie.title}
          poster={movie.poster_path}
          playing={playing && !showAd}
          muted={isMuted || showAd}
          zoomed={isZoomed}
          seekTo={seekTo}
          onSeekComplete={() => setSeekTo(null)}
          onLoadingChange={setLoading}
          onTimeUpdate={(seconds) => setWatchTime(seconds)}
          onSourceReady={handleSourceReady}
          onFallback={handleFallback}          
        />
      ) : (
        <VideoPlayer
          key={`fallback-${movie.id}-${selectedSource}`}
          source={PLAYER.source}
          loading={loading}
          setLoading={setLoading}
          setPlaying={setPlaying}
          setIsIframeActive={setIsIframeActive}
          isZoomed={isZoomed}
        />
      )}

      <PlayerControls
  movie={movie}
  sourceName={useFallbackPlayer ? PLAYER.title : sourceName}
  onOpenSources={() => setShowSources(true)}
  isMuted={isMuted}
  onToggleMute={() => setIsMuted((prev) => !prev)}
  isZoomed={isZoomed}
  onToggleZoom={handleToggleFullscreen}
  playing={playing && !showAd}
  onTogglePlay={() => setPlaying((prev) => !prev)}
  currentTime={watchTime}
  duration={(movie.runtime || 120) * 60}
/>

      {showAd && currentAd && (
        <AdOverlayPlayer
          ad={currentAd}
          countdown={adCountdown}
          onFinished={onAdFinished}
          onAdReady={onAdReady}
        />
      )}

      {process.env.NODE_ENV === "development" && showDebug && (
        <DebugPanel
          watchTime={watchTime}
          runtime={movie.runtime}
          nextAdTime={nextAdTime}
          adSchedule={adSchedule}
          currentAd={currentAd}
          showAd={showAd}
          playing={playing}
          loading={showAd ? false : loading && !playing}
          showDebug={showDebug}
        />
      )}

      <SourceSelector
        open={showSources}
        players={players}
        selectedSource={selectedSource}
        onSelect={(index) => {
          setSelectedSource(index);
          setUseFallbackPlayer(true);
          setSourceName(players[index].title);
          setLoading(true);
          setShowSources(false);
        }}
      />
    </div>
  );
}