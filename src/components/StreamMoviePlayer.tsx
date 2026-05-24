"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

interface MoviePlayerProps {
  movieId: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
}

type Status = "idle" | "loading" | "ready-hls" | "ready-embed" | "error";

interface StreamData {
  streamUrl?: string;
  proxyHeaders?: Record<string, string>;
  referer?: string;
  source?: string;
  embedUrl?: string;
  error?: string;
}

export default function StreamMoviePlayer({ movieId, title, poster, autoPlay }: MoviePlayerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<Hls | null>(null);
  const [status, setStatus]       = useState<Status>("idle");
  const [error, setError]         = useState("");
  const [source, setSource]       = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [embedUrl, setEmbedUrl]   = useState("");
  const [proxyHeaders, setProxyHeaders] = useState<Record<string, string>>({});

  const loadStream = useCallback(async () => {
    setStatus("loading");
    setError("");
    setSource("");

    try {
      const res  = await fetch(`/api/stream?id=${movieId}`);
      const data = (await res.json()) as StreamData;

      if (data.embedUrl) setEmbedUrl(data.embedUrl);

      if (data.streamUrl) {
        // Pass captured browser headers to proxy so CDN accepts our server requests
        const hdrs = data.proxyHeaders ?? {};
        setProxyHeaders(hdrs);
        const proxied = `/api/proxy?url=${encodeURIComponent(data.streamUrl)}&headers=${encodeURIComponent(JSON.stringify(hdrs))}`;
        setStreamUrl(proxied);
        setSource(data.source ?? "");
        setStatus("ready-hls");
      } else if (data.embedUrl) {
        setSource("Embed");
        setStatus("ready-embed");
      } else {
        setError(data.error ?? "No stream available.");
        setStatus("error");
      }
    } catch {
      setError("Network error — could not reach the stream API.");
      setStatus("error");
    }
  }, [movieId]);

  useEffect(() => {
    if (autoPlay) loadStream();
  }, [autoPlay, loadStream]);

  useEffect(() => {
    if (status !== "ready-hls" || !streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      hlsRef.current?.destroy();
      const hls = new Hls({
        maxBufferLength:        30,
        maxMaxBufferLength:     120,
        enableWorker:           true,
        fragLoadingTimeOut:     30000,
        manifestLoadingTimeOut: 20000,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) { setError(`HLS error: ${d.details}`); setStatus("error"); }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      void video.play().catch(() => {});
    } else {
      setError("Your browser does not support HLS playback.");
      setStatus("error");
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [status, streamUrl]);

  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  return (
    <div style={wrap}>
      {title && (
        <div style={header}>
          <span style={titleStyle}>{title}</span>
          {source && <span style={badge}>{source}</span>}
        </div>
      )}

      <div style={videoBox}>
        {status === "ready-hls" && (
          <video ref={videoRef} controls poster={poster} style={videoStyle} playsInline />
        )}

        {status === "ready-embed" && embedUrl && (
          // NO sandbox attribute — Videasy and other players detect & block it
          <iframe
            src={embedUrl}
            style={iframeStyle}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}

        {status !== "ready-hls" && status !== "ready-embed" && (
          <div style={overlay}>
            {status === "idle" && (
              <button style={playBtn} onClick={loadStream}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Play
              </button>
            )}
            {status === "loading" && (
              <div style={spinnerWrap}>
                <div style={spinnerEl} />
                <p style={loadingText}>Finding stream…</p>
              </div>
            )}
            {status === "error" && (
              <div style={errorWrap}>
                <p style={errorText}>{error}</p>
                <button style={retryBtn} onClick={loadStream}>Try again</button>
              </div>
            )}
          </div>
        )}
      </div>

      {(status === "ready-hls" || status === "ready-embed") && (
        <div style={infoBar}>
          <span style={infoLabel}>{status === "ready-hls" ? "HLS" : "Embed"}</span>
          <span style={infoUrl}>
            {(status === "ready-hls" ? streamUrl : embedUrl).slice(0, 90)}
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const wrap: React.CSSProperties = {
  width: "100%", fontFamily: "'DM Sans', system-ui, sans-serif",
  background: "#0a0a0a", borderRadius: 12, overflow: "hidden",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
};
const header: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", background: "#111", borderBottom: "1px solid #1f1f1f",
};
const titleStyle: React.CSSProperties = { color: "#f0f0f0", fontSize: 15, fontWeight: 600 };
const badge: React.CSSProperties = {
  background: "#1a1a2e", color: "#6c8bff", fontSize: 11, fontWeight: 600,
  padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
  letterSpacing: "0.04em", border: "1px solid #2a2a4e",
};
const videoBox: React.CSSProperties = {
  position: "relative", width: "100%", aspectRatio: "16/9", background: "#000",
};
const videoStyle: React.CSSProperties = { width: "100%", height: "100%", display: "block" };
const iframeStyle: React.CSSProperties = { width: "100%", height: "100%", border: "none", display: "block" };
const overlay: React.CSSProperties = {
  position: "absolute", inset: 0, display: "flex", alignItems: "center",
  justifyContent: "center", background: "linear-gradient(135deg, #0d0d1a 0%, #000 100%)",
};
const playBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, background: "#fff", color: "#000",
  border: "none", borderRadius: 50, padding: "14px 28px", fontSize: 16,
  fontWeight: 700, cursor: "pointer",
};
const spinnerWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
};
const spinnerEl: React.CSSProperties = {
  width: 40, height: 40,
  border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
const loadingText: React.CSSProperties = { color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 };
const errorWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: 16, padding: "0 32px", textAlign: "center",
};
const errorText: React.CSSProperties = { color: "#ff6b6b", fontSize: 14, lineHeight: 1.5, margin: 0 };
const retryBtn: React.CSSProperties = {
  background: "transparent", color: "#fff",
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
  padding: "8px 20px", fontSize: 13, cursor: "pointer",
};
const infoBar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 16px", background: "#0d0d0d", borderTop: "1px solid #1a1a1a",
};
const infoLabel: React.CSSProperties = {
  color: "#444", fontSize: 11, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
};
const infoUrl: React.CSSProperties = {
  color: "#333", fontSize: 11, fontFamily: "monospace",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};