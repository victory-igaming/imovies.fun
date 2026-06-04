"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import SubtitleSelector, { type SubtitleTrack } from "@/components/player/SubtitleSelector";

interface Props {
  movieId:           string | number;
  title:             string;
  poster?:           string;
  playing:           boolean;
  muted:             boolean;
  zoomed:            boolean;
  seekTo?:           number | null;
  onSeekComplete?:   () => void;
  onLoadingChange?:  (loading: boolean) => void;
  onTimeUpdate?:     (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onSourceReady?:         (sourceName: string) => void;
  onFallback?:            () => void;
  bustCache?:             boolean;  // append &bust=1 to /api/stream fetch
  // Subtitle state callbacks — used by MoviePlayer to sync sub state to PlayerControls
  onSubTracksChange?:     (tracks: SubtitleTrack[]) => void;
  onSubActiveChange?:     (index: number) => void;
  onRegisterSubSelect?:   (fn: (index: number, lang?: string) => void) => void;
}

type Phase = "fetching" | "playing";

interface QualityLevel { index: number; label: string; height: number; bitrate: number; }

function qualityLabel(level: { height?: number; bitrate?: number }): string {
  const h = level.height ?? 0;
  const b = Math.round((level.bitrate ?? 0) / 1000);
  if (h >= 1080) return "HD 1080p";
  if (h >= 720)  return "HD 720p";
  if (h >= 480)  return "SD 480p";
  if (h >= 360)  return "SD 360p";
  if (h > 0)     return `${h}p`;
  if (b > 0)     return `${b}k`;
  return "Auto";
}

function buildProxyUrl(
  streamUrl: string,
  headers: Record<string, string> | null,
  usedProxy: string | null,
): string {
  const h = encodeURIComponent(JSON.stringify(headers ?? {}));
  let url = `/api/proxy?url=${encodeURIComponent(streamUrl)}&headers=${h}`;
  if (usedProxy) url += `&proxy=${encodeURIComponent(usedProxy)}`;
  return url;
}

// Fetch external subtitle VTT — passes title for better search results
async function fetchExternalVtt(
  movieId: string | number,
  title: string,
  lang: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ id: String(movieId), lang, title });
    const res = await fetch(`/api/subtitles?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const blob = new Blob([text], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

const SHOW_QUALITY  = process.env.NEXT_PUBLIC_QUALITY_SELECTOR === "true";
const SHOW_NEXT_SRC = process.env.NEXT_PUBLIC_NEXT_SOURCE_BTN  === "true";

export default function VideoPlayer({
  movieId, title, poster, playing, muted, zoomed,
  seekTo, onSeekComplete,
  onLoadingChange, onTimeUpdate, onDurationChange,
  onSourceReady, onFallback, bustCache,
  onSubTracksChange, onSubActiveChange, onRegisterSubSelect,
}: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsRef        = useRef<any>(null);
  const activeRef     = useRef(true);
  const fellBackRef   = useRef(false);
  const hlsActiveRef  = useRef(false);
  const usedProxyRef  = useRef<string | null>(null);
  const vttBlobRef    = useRef<string | null>(null);
  // Suppress native onError while subtitle track is being injected
  const subInjectRef  = useRef(false);

  const [phase,        setPhase]        = useState<Phase>("fetching");
  const [fetchLabel,   setFetchLabel]   = useState("Extracting stream…");
  const [qualities,    setQualities]    = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showQuality,  setShowQuality]  = useState(false);
  const [subTracks,    setSubTracks]    = useState<SubtitleTrack[]>([]);
  const [activeSubIdx, setActiveSubIdx] = useState(-1);
  const [subLoading,   setSubLoading]   = useState(false);

  const doFallback = useCallback(() => {
    if (!activeRef.current || fellBackRef.current) return;
    fellBackRef.current  = true;
    hlsActiveRef.current = false;
    onFallback?.();
  }, [onFallback]);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsActiveRef.current = false;
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const revokeBlob = useCallback(() => {
    if (vttBlobRef.current) {
      URL.revokeObjectURL(vttBlobRef.current);
      vttBlobRef.current = null;
    }
  }, []);

  // ── Apply VTT subtitle track to <video> ───────────────────────────────────
  const applyVttTrack = useCallback((blobUrl: string | null) => {
    const video = videoRef.current;
    if (!video) return;

    // Suppress onError during track injection (DEMUXER_ERROR_COULD_NOT_PARSE
    // fires briefly when a new track element is added while video is playing)
    subInjectRef.current = true;

    video.querySelectorAll("track[data-ext]").forEach(t => t.remove());
    Array.from(video.textTracks).forEach(t => { t.mode = "disabled"; });

    if (blobUrl) {
      const track = document.createElement("track");
      track.setAttribute("data-ext", "1");
      track.kind    = "subtitles";
      track.src     = blobUrl;
      track.default = true;
      video.appendChild(track);
      setTimeout(() => {
        const tt = video.textTracks[video.textTracks.length - 1];
        if (tt) tt.mode = "showing";
        // Re-enable error handling after injection settles
        setTimeout(() => { subInjectRef.current = false; }, 500);
      }, 100);
    } else {
      setTimeout(() => { subInjectRef.current = false; }, 200);
    }
  }, []);

  // ── Subtitle selection ────────────────────────────────────────────────────
  const handleSubSelect = useCallback(async (index: number, lang?: string) => {
    const hls = hlsRef.current;
    setActiveSubIdx(index);
    onSubActiveChange?.(index);

    if (index === -1) {
      revokeBlob();
      applyVttTrack(null);
      if (hls) { hls.subtitleTrack = -1; hls.subtitleDisplay = false; }
      return;
    }

    if (index >= 0 && hls) {
      applyVttTrack(null);
      hls.subtitleTrack   = index;
      hls.subtitleDisplay = true;
      return;
    }

    if (!lang) return;
    setSubLoading(true);
    revokeBlob();
    applyVttTrack(null);

    const blobUrl = await fetchExternalVtt(movieId, title, lang);
    setSubLoading(false);

    if (blobUrl) {
      vttBlobRef.current = blobUrl;
      applyVttTrack(blobUrl);
    } else {
      console.warn(`[VideoPlayer] No subtitles found for lang: ${lang}`);
      setActiveSubIdx(-1);
    }
  }, [movieId, title, revokeBlob, applyVttTrack]);

  // Register subtitle select function with parent (MoviePlayer → PlayerControls)
  useEffect(() => {
    onRegisterSubSelect?.(handleSubSelect);
  }, [handleSubSelect]); // eslint-disable-line

  // ── Quality selection ─────────────────────────────────────────────────────
  const handleQualityChange = useCallback((levelIndex: number) => {
    setShowQuality(false);
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
  }, []);

  // ── Mount stream ──────────────────────────────────────────────────────────
  const mountStream = useCallback(async (
    streamUrl: string,
    proxyHeaders: Record<string, string> | null,
    sourceName: string,
  ) => {
    const video = videoRef.current;
    if (!video || !activeRef.current) return;

    destroyHls();
    revokeBlob();
    setQualities([]);
    setCurrentLevel(-1);
    setSubTracks([]);
    setActiveSubIdx(-1);

    const proxied = buildProxyUrl(streamUrl, proxyHeaders, usedProxyRef.current);
    const isHls   = /\.m3u8/i.test(streamUrl);
    const isMp4   = /\.(mp4|mkv|webm)/i.test(streamUrl);

    if (isHls) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        hlsActiveRef.current = false;
        video.src   = proxied;
        video.muted = muted;
        if (playing) video.play().catch(() => {});
        setPhase("playing");
        onLoadingChange?.(false);
        onSourceReady?.(sourceName);
        return;
      }

      try {
        const Hls = (await import("hls.js")).default;
        if (!Hls.isSupported()) { doFallback(); return; }

        const hls = new Hls({
          enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60,
          fragLoadingTimeOut: 30_000, manifestLoadingTimeOut: 20_000,
          levelLoadingTimeOut: 20_000, 
        });
        hls.subtitleDisplay = true;
        hlsRef.current       = hls;
        hlsActiveRef.current = true;

        hls.loadSource(proxied);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          if (!activeRef.current) return;
          if (SHOW_QUALITY && data.levels?.length > 1) {
            const seen = new Set<string>();
            const levels: QualityLevel[] = data.levels
              .map((l: any, i: number) => ({ index: i, label: qualityLabel(l), height: l.height ?? 0, bitrate: l.bitrate ?? 0 }))
              .filter((l: QualityLevel) => { if (seen.has(l.label)) return false; seen.add(l.label); return true; });
            setQualities(levels);
            setCurrentLevel(-1);
          }
          video.muted = muted;
          if (playing) video.play().catch(() => {});
          setPhase("playing");
          onLoadingChange?.(false);
          onSourceReady?.(sourceName);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_: any, data: any) => {
          const tracks: SubtitleTrack[] = (data.subtitleTracks ?? []).map((t: any, i: number) => ({
            index: i, name: t.name ?? t.lang ?? `Track ${i + 1}`,
            lang: (t.lang ?? "").toLowerCase().slice(0, 2), default: t.default ?? false,
          }));
          if (tracks.length > 0) {
            setSubTracks(tracks);
            onSubTracksChange?.(tracks);
          }
        });

        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_: any, data: any) => {
          const newIdx = data.id ?? -1;
          setActiveSubIdx(newIdx);
          onSubActiveChange?.(newIdx);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          if (hlsRef.current?.currentLevel === -1) setCurrentLevel(-1);
        });

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (!data.fatal || !activeRef.current) return;
          console.error("[VideoPlayer] HLS fatal:", data.type, data.details);
          if (data.type === "mediaError") { hls.recoverMediaError(); }
          else { doFallback(); }
        });

      } catch { doFallback(); }
      return;
    }

    if (isMp4) {
      hlsActiveRef.current = false;
      video.src   = proxied;
      video.muted = muted;
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        if (!activeRef.current) return;
        if (playing) video.play().catch(() => {});
        setPhase("playing");
        onLoadingChange?.(false);
        onSourceReady?.(sourceName);
      };
      video.addEventListener("canplay", onCanPlay);
      const timeout = setTimeout(() => {
        video.removeEventListener("canplay", onCanPlay);
        if (activeRef.current && phase !== "playing") doFallback();
      }, 15_000);
      video.addEventListener("canplay", () => clearTimeout(timeout), { once: true });
      return;
    }

    doFallback();
  }, [muted, playing, phase, destroyHls, revokeBlob, doFallback, onLoadingChange, onSourceReady]);

  // ── Fetch from /api/stream ────────────────────────────────────────────────
  const fetchStream = useCallback(async () => {
    if (!activeRef.current) return;
    fellBackRef.current  = false;
    hlsActiveRef.current = false;
    usedProxyRef.current = null;
    setPhase("fetching");
    setFetchLabel("Extracting stream…");
    onLoadingChange?.(true);

    try {
      setFetchLabel("Launching stream extractor…");
      const bust = bustCache ? '&bust=1' : '';
      const res = await fetch(`/api/stream?id=${movieId}${bust}`);
      if (!activeRef.current) return;
      if (!res.ok) { doFallback(); return; }

      const data = await res.json();
      if (!activeRef.current) return;
      if (!data.streamUrl) { console.warn("[VideoPlayer] no streamUrl → fallback"); doFallback(); return; }

      usedProxyRef.current = data.usedProxy ?? null;
      console.log(`[VideoPlayer] ✓ ${data.source}: ${data.streamUrl.slice(0, 80)}`);

      setFetchLabel(`Loading ${data.source}…`);
      await mountStream(data.streamUrl, data.proxyHeaders ?? null, data.source ?? "Stream");
    } catch (err) {
      console.error("[VideoPlayer] fetch error:", err);
      doFallback();
    }
  }, [movieId, mountStream, onLoadingChange, doFallback]);

  useEffect(() => {
    activeRef.current    = true;
    fellBackRef.current  = false;
    hlsActiveRef.current = false;
    fetchStream();
    return () => { activeRef.current = false; destroyHls(); revokeBlob(); };
  }, [movieId]); // eslint-disable-line

  useEffect(() => {
    const v = videoRef.current;
    if (!v || phase !== "playing") return;
    playing ? v.play().catch(() => {}) : v.pause();
  }, [playing, phase]);

  useEffect(() => { const v = videoRef.current; if (v) v.muted = muted; }, [muted]);

  useEffect(() => {
    if (seekTo == null) return;
    const v = videoRef.current;
    if (v) v.currentTime = seekTo;
    onSeekComplete?.();
  }, [seekTo]); // eslint-disable-line

  useEffect(() => {
    if (!showQuality) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-quality-menu]")) setShowQuality(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showQuality]);

  const currentQualityLabel = currentLevel === -1
    ? "Auto"
    : qualities.find(q => q.index === currentLevel)?.label ?? "Auto";

  return (
    <div className={`relative aspect-video overflow-hidden bg-black transition-transform duration-500 ${zoomed ? "scale-125" : "scale-100"}`}>
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${phase === "playing" ? "opacity-100" : "opacity-0"}`}
        poster={poster ? `https://image.tmdb.org/t/p/w780${poster}` : undefined}
        playsInline
        muted={muted}
        onTimeUpdate={() => { const v = videoRef.current; if (v) onTimeUpdate?.(v.currentTime); }}
        onDurationChange={() => { const v = videoRef.current; if (v && isFinite(v.duration)) onDurationChange?.(v.duration); }}
        onError={(e) => {
          // Suppress errors while HLS.js is active (it handles its own errors)
          if (hlsActiveRef.current) return;
          // Suppress errors during subtitle track injection
          if (subInjectRef.current) return;
          if (phase !== "playing") return;
          const msg = (e.target as HTMLVideoElement).error?.message ?? "unknown";
          console.error("[VideoPlayer] native error:", msg);
          doFallback();
        }}
      />

      {/* ── Top-right: Subtitles + Quality ──────────────────────────────── */}
      {phase === "playing" && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <SubtitleSelector
            tracks={subTracks}
            activeIndex={activeSubIdx}
            onSelect={handleSubSelect}
            movieId={movieId}
          />
          {subLoading && <Loader2 size={14} className="animate-spin text-cyan-400" />}

          {SHOW_QUALITY && qualities.length > 1 && (
            <div data-quality-menu className="relative">
              <button
                onClick={() => setShowQuality(v => !v)}
                className="flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 transition active:scale-90"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                {currentQualityLabel}
                <ChevronDown size={10} className={`transition-transform ${showQuality ? "rotate-180" : ""}`} />
              </button>
              {showQuality && (
                <div className="absolute right-0 top-full mt-1 min-w-[130px] rounded-xl bg-black/90 backdrop-blur-md border border-white/10 overflow-hidden shadow-2xl">
                  <button onClick={() => handleQualityChange(-1)} className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition hover:bg-white/10 ${currentLevel === -1 ? "text-cyan-400" : "text-white"}`}>
                    Auto{currentLevel === -1 && <span className="ml-1 text-[10px] opacity-60">(ABR)</span>}
                  </button>
                  {[...qualities].sort((a, b) => b.height - a.height).map(q => (
                    <button key={q.index} onClick={() => handleQualityChange(q.index)} className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition hover:bg-white/10 ${currentLevel === q.index ? "text-cyan-400" : "text-white"}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {SHOW_NEXT_SRC && phase === "playing" && (
        <button onClick={doFallback} className="absolute right-3 bottom-16 z-20 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 transition active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
          Next Source
        </button>
      )}

      {phase === "fetching" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black pointer-events-none">
          <img src="/logos/logo.png" alt="Logo" className="mb-6 w-28 animate-pulse" />
          <Loader2 size={58} className="animate-spin text-cyan-400" />
          <p className="mt-5 text-sm text-gray-400">{fetchLabel}</p>
          <p className="mt-2 text-xs text-gray-600">This may take 15–40s on first load</p>
        </div>
      )}
    </div>
  );
}