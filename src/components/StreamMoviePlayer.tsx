"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, RotateCcw } from "lucide-react";

interface Props {
  movieId: string | number;
  title?: string;
  poster?: string;
  playing: boolean;
  muted: boolean;
  zoomed: boolean;
  startAt?: number;
  seekTo?: number | null;
  onSeekComplete?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onTimeUpdate?: (seconds: number) => void;
  onSourceReady?: (sourceName: string) => void;
  onFallback?: () => void;
  
}

type Status = "loading" | "ready-hls" | "ready-embed" | "error";

const inFlight = new Map<string, Promise<any>>();

async function fetchStream(movieId: string | number) {
  const key = String(movieId);

  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const request = fetch(`/api/stream?id=${key}`)
    .then((res) => res.json())
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);

  return request;
}

export default function StreamMoviePlayer({
  movieId,
  title,
  poster,
  playing,
  muted,
  zoomed,
  startAt = 0,
  seekTo,
  onSeekComplete,
  onTimeUpdate,
  onSourceReady,
  onLoadingChange,
  onFallback,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [streamUrl, setStreamUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedList, setEmbedList] = useState<string[]>([]);
  const [embedIndex, setEmbedIndex] = useState(0);
  const [error, setError] = useState("");

  const destroyHls = useCallback(() => {
    if (!hlsRef.current) return;

    hlsRef.current.stopLoad();
    hlsRef.current.detachMedia();
    hlsRef.current.destroy();
    hlsRef.current = null;
  }, []);

  const switchToEmbed = useCallback(
    (index = 0) => {
      if (!mountedRef.current) return;

      if (embedList[index]) {
        setEmbedIndex(index);
        setEmbedUrl(embedList[index]);
        setStatus("ready-embed");
        setError("");
        onSourceReady?.(`Embed ${index + 1}`);
        onLoadingChange?.(false);
      } else {
        setStatus("error");
        setError("All sources failed.");
        onLoadingChange?.(false);
        onFallback?.();
      }
    },
    [embedList, onFallback, onLoadingChange, onSourceReady]
  );

  const loadStream = useCallback(async () => {
    destroyHls();

    setStatus("loading");
    setError("");
    setStreamUrl("");
    setEmbedUrl("");
    setEmbedList([]);
    setEmbedIndex(0);

    onLoadingChange?.(true);

    try {
      const data = await fetchStream(movieId);

      if (!mountedRef.current) return;

      const fallbacks: string[] =
        data.embedFallbacks ?? (data.embedUrl ? [data.embedUrl] : []);

      setEmbedList(fallbacks);

      if (data.streamUrl) {
        const headers = data.proxyHeaders ?? {};

        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(
          data.streamUrl
        )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;

        setStreamUrl(proxiedUrl);
        setStatus("ready-hls");
        onSourceReady?.(data.source || "HLS");
      } else if (fallbacks.length > 0) {
        setEmbedUrl(fallbacks[0]);
        setStatus("ready-embed");
        onSourceReady?.("Embed 1");
      } else {
        setStatus("error");
        setError("No stream available.");
        onFallback?.();
      }
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Failed to load stream.");
      onFallback?.();
    } finally {
      onLoadingChange?.(false);
    }
  }, [
    movieId,
    destroyHls,
    onFallback,
    onLoadingChange,
    onSourceReady,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    loadStream();

    return () => {
      mountedRef.current = false;
      destroyHls();
    };
  }, [movieId]);

  useEffect(() => {
    if (status !== "ready-hls" || !streamUrl) return;

    const video = videoRef.current;
    if (!video) return;

    destroyHls();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 20000,
        fragLoadingTimeOut: 30000,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onLoadingChange?.(false);

        if (startAt > 0) {
          video.currentTime = startAt;
        }

        if (playing) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        console.warn("HLS fatal error:", data.details);

        destroyHls();

        if (embedList.length > 0) {
          setEmbedUrl(embedList[0]);
          setEmbedIndex(0);
          setStatus("ready-embed");
          onSourceReady?.("Embed 1");
          onLoadingChange?.(false);
        } else {
          setStatus("error");
          setError(`HLS error: ${data.details}`);
          onLoadingChange?.(false);
          onFallback?.();
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;

      if (startAt > 0) {
        video.currentTime = startAt;
      }

      if (playing) {
        video.play().catch(() => {});
      }
    } else if (embedList.length > 0) {
      setEmbedUrl(embedList[0]);
      setEmbedIndex(0);
      setStatus("ready-embed");
      onSourceReady?.("Embed 1");
    } else {
      setStatus("error");
      setError("HLS is not supported.");
      onFallback?.();
    }

    return () => {
      destroyHls();
    };
  }, [status, streamUrl, embedList]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || status !== "ready-hls") return;

    video.muted = muted;

    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing, muted, status]);

  const handleNextEmbed = () => {
    const next = embedIndex + 1;

    if (embedList[next]) {
      setEmbedIndex(next);
      setEmbedUrl(embedList[next]);
      onSourceReady?.(`Embed ${next + 1}`);
    } else {
      onFallback?.();
    }
  };

  useEffect(() => {
  const video = videoRef.current;

  if (!video) return;

  if (seekTo === null || seekTo === undefined) return;

  video.currentTime = seekTo;
  onSeekComplete?.();
}, [seekTo, onSeekComplete]);

  return (
    <div className="relative aspect-video overflow-hidden bg-black">
      {status === "ready-hls" && (
        <video
          ref={videoRef}
          poster={poster}
          playsInline
          muted={muted}
          onTimeUpdate={(e) =>
            onTimeUpdate?.(Math.floor(e.currentTarget.currentTime))
          }
          className={`
            h-full
            w-full
            object-cover
            transition-transform
            duration-500
            ${zoomed ? "scale-100" : "scale-100"}
          `}
        />
      )}

      {status === "ready-embed" && embedUrl && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          onLoad={() => onLoadingChange?.(false)}
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {status === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black">
          <img
            src="/logos/logo.png"
            alt="Logo"
            className="mb-6 w-28 animate-pulse"
          />

          <Loader2
            size={58}
            className="animate-spin text-cyan-400"
          />

          <p className="mt-5 text-sm text-gray-400">
            Loading cinematic stream...
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black text-center">
          <img
            src="/logos/logo.png"
            alt="Logo"
            className="mb-6 w-28 opacity-80"
          />

          <p className="mb-5 max-w-md px-6 text-sm text-red-400">
            {error}
          </p>

          <div className="flex gap-3">
            <button
              onClick={loadStream}
              className="flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 font-bold text-white transition hover:scale-105"
            >
              <RotateCcw size={18} />
              Reload Stream
            </button>

            {embedList.length > 0 && (
              <button
                onClick={() => switchToEmbed(0)}
                className="rounded-full border border-white/20 px-6 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Use Backup
              </button>
            )}
          </div>
        </div>
      )}

      {status === "ready-embed" && embedList.length > 1 && (
        <button
          onClick={handleNextEmbed}
          className="absolute right-4 top-4 z-20 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white backdrop-blur-xl"
        >
          Next Source
        </button>
      )}
    </div>
  );
}