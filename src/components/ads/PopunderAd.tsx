// src/components/ads/PopunderAd.tsx

"use client";

import { useEffect } from "react";

const POPUNDER_SCRIPT =
  "https://pl29643906.effectivecpmnetwork.com/a4/2c/af/a42cafeb36fa124d3219930d9d8c6b9f.js";

export default function PopunderAd() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.querySelector(
      `script[src="${POPUNDER_SCRIPT}"]`
    );

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = POPUNDER_SCRIPT;
    script.async = true;
    script.type = "text/javascript";

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}