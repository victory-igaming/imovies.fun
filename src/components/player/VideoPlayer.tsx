"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  source: string;
  loading: boolean;
  setLoading: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  setIsIframeActive: (value: boolean) => void;
  isZoomed: boolean;
  onFailed?: () => void;
}

export default function VideoPlayer({
  source,
  loading,
  setLoading,
  setPlaying,
  setIsIframeActive,
  isZoomed,
  onFailed,
}: Props) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;

    setLoading(true);
    setPlaying(true);
    setIsIframeActive(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (loadedRef.current) return;

      setLoading(false);
      onFailed?.();
    }, 10000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [source]);

  useEffect(() => {
    const handleVisibility = () => {
      const active = !document.hidden;
      setIsIframeActive(active);
      setPlaying(active);
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [setIsIframeActive, setPlaying]);

  return (
    <div className="relative aspect-video overflow-hidden bg-black">
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
          <img
            src="/logos/logo.png"
            alt="iMovies"
            className="mb-6 w-28 animate-pulse"
          />

          <Loader2 className="animate-spin text-cyan-400" size={60} />

          <p className="mt-6 text-gray-400">
            Loading cinematic experience...
          </p>
        </div>
      )}

      <iframe
        key={source}
        src={source}
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerPolicy="no-referrer"
        title="VIDEO"
        className={`absolute inset-0 h-full w-full border-0 transition-transform duration-300 ${
          isZoomed ? "scale-125" : "scale-100"
        }`}
        onLoad={() => {
          loadedRef.current = true;

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          setTimeout(() => {
            setLoading(false);
            setPlaying(true);
            setIsIframeActive(true);
          }, 1500);
        }}
      />
    </div>
  );
}