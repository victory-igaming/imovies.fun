"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface Props {
  adSlot?: string;

  adFormat?: string;

  className?: string;

  style?: React.CSSProperties;
}

export default function AdsenseBanner({
  adSlot = "1234567890",
  adFormat = "auto",
  className = "",
  style,
}: Props) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (
          window.adsbygoogle =
            window.adsbygoogle || []
        ).push({});
      }
    } catch (error) {
      console.error(
        "AdSense Error:",
        error
      );
    }
  }, []);

  return (
    <div
      className={`
        relative
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        ${className}
      `}
    >
      {/* HEADER */}
      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-white/10
          px-4
          py-3
        "
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />

          <span className="text-sm font-medium text-gray-300">
            Sponsored
          </span>
        </div>

        <span className="text-xs text-gray-500">
          Advertisement
        </span>
      </div>

      {/* ADSENSE */}
      <div className="p-4">
        <ins
          className={`adsbygoogle block ${className}`}
          style={{
            display: "block",
            ...style,
          }}
          data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
          data-ad-slot={adSlot}
          data-ad-format={adFormat}
          data-full-width-responsive="true"
        />

        {/* FALLBACK */}
        <div
          className="
            absolute
            inset-0
            flex
            flex-col
            items-center
            justify-center
            bg-gradient-to-br
            from-cyan-500/10
            to-blue-500/10
            pointer-events-none
          "
        >
          <div
            className="
              rounded-2xl
              border
              border-cyan-400/20
              bg-black/40
              px-6
              py-4
              backdrop-blur-xl
            "
          >
            <h3 className="text-lg font-bold text-white">
              Premium Sponsor
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Your advertisement appears here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}