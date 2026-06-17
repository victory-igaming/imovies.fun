// src/components/ads/NativeBannerAd.tsx

"use client";

import { useEffect } from "react";

const NATIVE_BANNER_SCRIPT =
  "https://pl29643907.effectivecpmnetwork.com/e3dbe930f0fe534d9aaad69bea6d7030/invoke.js";

const NATIVE_CONTAINER_ID =
  "container-e3dbe930f0fe534d9aaad69bea6d7030";

export default function NativeBannerAd() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.querySelector(
      `script[src="${NATIVE_BANNER_SCRIPT}"]`
    );

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = NATIVE_BANNER_SCRIPT;
    script.async = true;
    script.type = "text/javascript";
    script.setAttribute("data-cfasync", "false");

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="my-4 w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
      <div
        id={NATIVE_CONTAINER_ID}
        className="min-h-[280px] w-full overflow-hidden rounded-[22px]"
      />
    </div>
  );
}