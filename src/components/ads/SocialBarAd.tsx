// src/components/ads/SocialBarAd.tsx

"use client";

import { useEffect } from "react";

const SOCIAL_BAR_SCRIPT =
  "https://pl29643909.effectivecpmnetwork.com/2a/93/5a/2a935ab004e0f0f4de37620e48033355.js";

export default function SocialBarAd() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.querySelector(
      `script[src="${SOCIAL_BAR_SCRIPT}"]`
    );

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = SOCIAL_BAR_SCRIPT;
    script.async = true;
    script.type = "text/javascript";

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}