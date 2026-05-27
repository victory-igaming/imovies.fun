"use client";

// Matches ApiResult from app/api/stream/route.ts
interface StreamSuccess {
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
  embedUrl: string;
  embedFallbacks: string[];
}
interface EmbedOnly {
  streamUrl: null;
  proxyHeaders: null;
  source: null;
  embedUrl: string;
  embedFallbacks: string[];
}
type ApiResult = StreamSuccess | EmbedOnly;

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
  onDurationChange?: (seconds: number) => void;
  onSourceReady?: (sourceName: string) => void;
  onFallback?: () => void;
}

type Status = "loading" | "ready-hls" | "ready-embed" | "error";

// Module-level dedup — prevents StrictMode double-invoke from firing two requests
const inFlight = new Map<string, Promise<ApiResult>>();

async function fetchStream(id: string | number): Promise<ApiResult> {
  const key = String(id);
  if (inFlight.has(key)) return inFlight.get(key)!;
  const p = fetch(`/api/stream?id=${key}`)
    .then((r) => r.json() as Promise<ApiResult>)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export default function StreamMoviePlayer({
  movieId, poster, playing, muted, zoomed,
  startAt = 0, seekTo, onSeekComplete,
  onTimeUpdate, onDurationChange,
  onSourceReady, onLoadingChange, onFallback,
}: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const hlsRef     = useRef<Hls | null>(null);
  const mountedRef = useRef(true);
  const loadedId   = useRef<string>("");

  const [status,     setStatus]     = useState<Status>("loading");
  const [streamUrl,  setStreamUrl]  = useState("");
  const [embedUrl,   setEmbedUrl]   = useState("");
  const [embedList,  setEmbedList]  = useState<string[]>([]);
  const [embedIndex, setEmbedIndex] = useState(0);
  const [error,      setError]      = useState("");

  const destroyHls = useCallback(() => {
    if (!hlsRef.current) return;
    hlsRef.current.stopLoad();
    hlsRef.current.detachMedia();
    hlsRef.current.destroy();
    hlsRef.current = null;
  }, []);

  const goEmbed = useCallback((list: string[], idx: number) => {
    if (!mountedRef.current) return;
    if (!list[idx]) {
      setError("All sources exhausted.");
      setStatus("error");
      onFallback?.();
      return;
    }
    setEmbedList(list);
    setEmbedIndex(idx);
    setEmbedUrl(list[idx]!);
    setStatus("ready-embed");
    onSourceReady?.(`Embed ${idx + 1}`);
    onLoadingChange?.(false);
  }, [onFallback, onLoadingChange, onSourceReady]);

  const loadStream = useCallback(async () => {
    const id = String(movieId);
    destroyHls();
    mountedRef.current = true;
    setStatus("loading");
    setError("");
    setStreamUrl("");
    setEmbedUrl("");
    setEmbedList([]);
    setEmbedIndex(0);
    onLoadingChange?.(true);

    try {
      const data = await fetchStream(id);
      if (!mountedRef.current) return;

      const fallbacks: string[] =
        data.embedFallbacks ?? (data.embedUrl ? [data.embedUrl] : []);
      setEmbedList(fallbacks);

      if (data.streamUrl) {
        const proxied = `/api/proxy?url=${encodeURIComponent(data.streamUrl)}&headers=${encodeURIComponent(JSON.stringify(data.proxyHeaders ?? {}))}`;
        setStreamUrl(proxied);
        setStatus("ready-hls");
        onSourceReady?.(data.source ?? "HLS");
        // onLoadingChange(false) called after MANIFEST_PARSED
      } else if (fallbacks.length > 0) {
        goEmbed(fallbacks, 0);
      } else {
        setError("No stream available.");
        setStatus("error");
        onFallback?.();
        onLoadingChange?.(false);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message ?? "Failed to load stream.");
      setStatus("error");
      onFallback?.();
      onLoadingChange?.(false);
    }
  }, [movieId, destroyHls, goEmbed, onSourceReady, onLoadingChange, onFallback]);

  // Load on mount / movieId change
  useEffect(() => {
    mountedRef.current = true;
    if (loadedId.current !== String(movieId)) {
      loadedId.current = String(movieId);
      loadStream();
    }
    return () => {
      mountedRef.current = false;
      destroyHls();
    };
  }, [movieId]); // eslint-disable-line

  // Attach HLS — video element is always in DOM so ref is always valid
    useEffect(() => {
      if (status !== "ready-hls" || !streamUrl) return;

      const video = videoRef.current;
      if (!video) return;

      destroyHls();

      const switchToFallback = (reason: string) => {
        console.warn(`[player] Switching to fallback: ${reason}`);

        destroyHls();
        onLoadingChange?.(false);
        onFallback?.();

        // if (embedList.length > 0) {
        //   goEmbed(embedList, 0);
        // } else {
        //   setError(`Stream error: ${reason}`);
        //   setStatus("error");
        //   onFallback?.();
        // }


      };

      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;

          if (startAt > 0) video.currentTime = startAt;
          if (playing) void video.play().catch(() => {});
        } else {
          switchToFallback("HLS not supported");
        }

        return;
      }

      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferHole: 0.5,
        startFragPrefetch: false,
        testBandwidth: false,
        fragLoadingTimeOut: 30_000,
        manifestLoadingTimeOut: 20_000,
        levelLoadingTimeOut: 20_000,
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!mountedRef.current) return;

        onLoadingChange?.(false);

        if (startAt > 0) video.currentTime = startAt;
        if (playing) void video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn("[player] HLS error:", data);

        if (!data.fatal) return;

        console.error(`[player] HLS fatal: ${data.details}`);

        if (
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT
        ) {
          switchToFallback(data.details);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn("[player] Recovering media error");
          hls.recoverMediaError();
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          switchToFallback(data.details || "network error");
          return;
        }

        switchToFallback(data.details || "unknown fatal error");
      });

      return destroyHls;
    }, [streamUrl]);

  // Play / pause / mute sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== "ready-hls") return;
    video.muted = muted;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing, muted, status]);

  // Seek
  useEffect(() => {
    if (seekTo == null) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seekTo;
    onSeekComplete?.();
  }, [seekTo]); // eslint-disable-line

  const handleNextEmbed = useCallback(() => {
    const next = embedIndex + 1;
    if (embedList[next]) {
      setEmbedIndex(next);
      setEmbedUrl(embedList[next]!);
      onSourceReady?.(`Embed ${next + 1}`);
    } else {
      onFallback?.();
    }
  }, [embedIndex, embedList, onSourceReady, onFallback]);

  return (
    <div className="relative aspect-video overflow-hidden bg-black">

      {/* Video — always mounted so ref never goes null */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        muted={muted}
        style={{ display: status === "ready-hls" ? "block" : "none" }}
        onTimeUpdate={(e) => onTimeUpdate?.(Math.floor(e.currentTarget.currentTime))}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) onDurationChange?.(Math.floor(d));
        }}
        className={`h-full w-full object-cover transition-transform duration-500 `}
      />

      {/* Embed — NO sandbox, referrerPolicy=no-referrer-when-downgrade */}
      {status === "ready-embed" && embedUrl && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          className={`absolute inset-0 h-full w-full border-0 transition-transform duration-500 `}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => onLoadingChange?.(false)}
        />
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black">
          <img src="/logos/logo.png" alt="Logo" className="mb-6 w-28 animate-pulse" />
          <Loader2 size={58} className="animate-spin text-cyan-400" />
          <p className="mt-5 text-sm text-gray-400">Loading cinematic stream...</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black text-center">
          <img src="/logos/logo.png" alt="Logo" className="mb-6 w-28 opacity-80" />
          <p className="mb-5 max-w-md px-6 text-sm text-red-400">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { loadedId.current = ""; loadStream(); }}
              className="flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 font-bold text-white shadow-[0_0_30px_rgba(34,211,238,0.35)] transition hover:scale-105"
            >
              <RotateCcw size={18} /> Reload Stream
            </button>
            {embedList.length > 0 && (
              <button
                onClick={() => goEmbed(embedList, 0)}
                className="rounded-full border border-white/20 px-6 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Use Backup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Next embed button */}
      {status === "ready-embed" && embedList.length > embedIndex + 1 && (
        <button
          onClick={handleNextEmbed}
          className="absolute right-4 top-4 z-20 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-cyan-500"
        >
          Next Source ›
        </button>
      )}
    </div>
  );
}