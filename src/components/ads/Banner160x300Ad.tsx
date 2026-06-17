// src/components/ads/Banner160x300Ad.tsx

"use client";

import { useEffect, useRef } from "react";

const BANNER_KEY = "2ed003bd7bbd57c5dd8aefd40e4d6bf0";
const BANNER_SCRIPT =
  "https://www.highperformanceformat.com/2ed003bd7bbd57c5dd8aefd40e4d6bf0/invoke.js";

export default function Banner160x300Ad() {
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
        'height' : 300,
        'width' : 160,
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
    <div className="my-4 flex w-full justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
      <div
        ref={adRef}
        className="flex min-h-[300px] w-[160px] items-center justify-center overflow-hidden"
      />
    </div>
  );
}