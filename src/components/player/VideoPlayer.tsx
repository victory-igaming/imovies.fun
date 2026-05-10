"use client";
import { useEffect} from "react";
import { Loader2 } from "lucide-react";

interface Props {
  source: string;

  loading: boolean;

  setLoading: (value: boolean) => void;

  setPlaying: (value: boolean) => void;

  setIsIframeActive: ( value: boolean ) => void;

  isZoomed: boolean;
}

export default function VideoPlayer({
  source,
  loading,
  setLoading,
  setPlaying,
  setIsIframeActive,
  isZoomed,
}: Props) {

 
/* WATCH TIME TRACKER */
useEffect(() => {
  const handleVisibility =
    () => {
      const active =
        !document.hidden;

      setIsIframeActive(
        active
      );

      setPlaying(active);
    };

  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  return () => {
    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    );
  };
}, []);




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

          <p className="mt-6 text-gray-400">Loading cinematic experience...</p>
        </div>
      )}

      {/* VIDEO IFRAME */}
      <iframe
        src={source}
        allowFullScreen
        allow="autoplay; fullscreen"
        className={`
          absolute inset-0 h-full w-full border-0 transition-transform duration-500
          ${isZoomed ? "scale-125" : "scale-100"} 
        `}
        onLoad={() => setLoading(false)}
        title="VIDEO"
      />
    </div>
  );
}
