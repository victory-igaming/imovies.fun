// src/components/ads/Banner320x50Ad.tsx

"use client";

import { useEffect, useRef } from "react";

const BANNER_KEY = "0b378a95942a92ed9b80ca2df608f1e4";
const BANNER_SCRIPT =
  "https://www.highperformanceformat.com/0b378a95942a92ed9b80ca2df608f1e4/invoke.js";

export default function Banner320x50Ad() {
  const adRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!adRef.current) return;

    const container = adRef.current;
    container.innerHTML = "";

    const optionsScript = document.createElement("script");
    optionsScript.type = "text/javascript";
    optionsScript.innerHTML = `
      atOptions = {
        'key' : '${BANNER_KEY}',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    `;

    const invokeScript = document.createElement("script");
    invokeScript.src = BANNER_SCRIPT;
    invokeScript.type = "text/javascript";
    invokeScript.async = true;

    container.appendChild(optionsScript);
    container.appendChild(invokeScript);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="my-4 flex w-full justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03] p-2">
      <div
        ref={adRef}
        className="flex min-h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden"
      />
    </div>
  );
}