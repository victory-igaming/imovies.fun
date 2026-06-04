"use client";

/**
 * SubtitleSelector
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows available subtitle tracks from the HLS stream.
 * Falls back to a hardcoded language list when the stream has no embedded subs,
 * using OpenSubtitles-compatible language codes so the parent can fetch .vtt files.
 *
 * Props:
 *   tracks       — subtitle tracks from HLS.js (may be empty)
 *   activeIndex  — currently active track index (-1 = off)
 *   onSelect     — called with track index (-1 = off) or language code string
 *   movieId      — TMDB id, used to build subtitle fetch URLs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";
import { Subtitles, X } from "lucide-react";

export interface SubtitleTrack {
  index:   number;
  name:    string;
  lang:    string;   // BCP-47 / ISO 639 code, e.g. "en", "si", "ta", "hi"
  default: boolean;
}

// Language list shown when stream has no embedded subtitle tracks.
// Users can select one and the parent fetches a .vtt from an external source.
const FALLBACK_LANGUAGES: SubtitleTrack[] = [
  { index: 0, name: "English",    lang: "en", default: true  },
  { index: 1, name: "Sinhala",    lang: "si", default: false },
  { index: 2, name: "Tamil",      lang: "ta", default: false },
  { index: 3, name: "Hindi",      lang: "hi", default: false },
  { index: 4, name: "Arabic",     lang: "ar", default: false },
  { index: 5, name: "French",     lang: "fr", default: false },
  { index: 6, name: "Spanish",    lang: "es", default: false },
  { index: 7, name: "German",     lang: "de", default: false },
  { index: 8, name: "Japanese",   lang: "ja", default: false },
  { index: 9, name: "Korean",     lang: "ko", default: false },
  { index: 10, name: "Chinese",   lang: "zh", default: false },
  { index: 11, name: "Malayalam", lang: "ml", default: false },
  { index: 12, name: "Telugu",    lang: "te", default: false },
];

// Language flag emoji (approximate — just for visual flair)
const FLAG: Record<string, string> = {
  en: "🇺🇸", si: "🇱🇰", ta: "🇮🇳", hi: "🇮🇳", ar: "🇸🇦",
  fr: "🇫🇷", es: "🇪🇸", de: "🇩🇪", ja: "🇯🇵", ko: "🇰🇷",
  zh: "🇨🇳", ml: "🇮🇳", te: "🇮🇳",
};

interface Props {
  /** HLS embedded tracks (pass [] if none / not an HLS stream) */
  tracks:      SubtitleTrack[];
  /** Currently active track index, or -1 for off */
  activeIndex: number;
  /** Called with track index for HLS tracks, or -100 - langIndex for fallback */
  onSelect:    (index: number, lang?: string) => void;
  movieId?:    string | number;
  className?:  string;
}

export default function SubtitleSelector({
  tracks,
  activeIndex,
  onSelect,
  className = "",
}: Props) {
  const [open, setOpen]   = useState(false);
  const panelRef          = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Use HLS embedded tracks if available, otherwise show fallback language list
  const useEmbedded = tracks.length > 0;
  const displayList = useEmbedded ? tracks : FALLBACK_LANGUAGES;

  // Determine active label for button
  const activeTrack = activeIndex === -1
    ? null
    : useEmbedded
      ? tracks[activeIndex]
      : FALLBACK_LANGUAGES.find((_, i) => -(100 + i) === activeIndex);

  const buttonLabel = activeTrack
    ? `${FLAG[activeTrack.lang] ?? "🌐"} ${activeTrack.name}`
    : "Off";

  const isSubOn = activeIndex !== -1;

  return (
    <div ref={panelRef} className={`relative ${className}`}>
      {/* ── Toggle button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Subtitles"
        title="Subtitles / CC"
        className={`
          flex items-center gap-1.5 rounded-full backdrop-blur-sm px-3 py-1.5
          text-[11px] font-semibold transition active:scale-90
          ${isSubOn
            ? "bg-cyan-500 text-white"
            : "bg-white/10 text-gray-300 hover:bg-cyan-500 hover:text-white"
          }
        `}
      >
        <Subtitles size={13} />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>

      {/* ── Dropdown panel ────────────────────────────────────────────────── */}
      {open && (
        <div className="
          absolute bottom-full mb-2 right-0 z-50
          w-52 rounded-2xl bg-black/95 backdrop-blur-xl
          border border-white/10 shadow-2xl overflow-hidden
        ">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Subtitles</span>
            <button
            title="close"
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white transition"
            >
              <X size={14} />
            </button>
          </div>

          {/* Off option */}
          <button
            type="button"
            onClick={() => { onSelect(-1); setOpen(false); }}
            className={`
              w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold
              transition hover:bg-white/5
              ${activeIndex === -1 ? "text-cyan-400" : "text-gray-400"}
            `}
          >
            <span className="w-5 text-center">🚫</span>
            Off
            {activeIndex === -1 && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
            )}
          </button>

          {/* Track / language list */}
          <div className="max-h-64 overflow-y-auto">
            {displayList.map((track, i) => {
              const selectIndex = useEmbedded ? track.index : -(100 + i);
              const isActive    = useEmbedded
                ? activeIndex === track.index
                : activeIndex === selectIndex;

              return (
                <button
                  type="button"
                  key={`${track.lang}-${i}`}
                  onClick={() => { onSelect(selectIndex, track.lang); setOpen(false); }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold
                    transition hover:bg-white/5
                    ${isActive ? "text-cyan-400 bg-cyan-500/10" : "text-gray-300"}
                  `}
                >
                  <span className="w-5 text-center">{FLAG[track.lang] ?? "🌐"}</span>
                  {track.name}
                  {track.default && !isActive && (
                    <span className="ml-auto text-[10px] text-gray-600">default</span>
                  )}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          {!useEmbedded && (
            <div className="px-4 py-2.5 border-t border-white/10">
              <p className="text-[10px] text-gray-600 leading-relaxed">
                External subtitles — availability depends on the stream source.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}