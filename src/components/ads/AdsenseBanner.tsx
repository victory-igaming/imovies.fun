"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdsenseBanner() {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Ensure the array structure exists globally
    window.adsbygoogle = window.adsbygoogle || [];

    try {
      if (
        adRef.current &&
        !adRef.current.hasAttribute("data-adsbygoogle-status") &&
        adRef.current.innerHTML.trim() === ""
      ) {
        // Prevent race conditions and immediately push the ad layout initialization
        adRef.current.setAttribute("data-adsbygoogle-status", "primed");
        window.adsbygoogle.push({});
      }
    } catch (error) {
      console.error("AdSense activation block bypass caught:", error);
    }
  }, []);

  return (
    <div className="ad-container my-6 w-full flex justify-center clear-both">
      <ins
        ref={adRef}
        className="adsbygoogle"
        // Force standard fixed layout bounds so Google never reads 0px width
        style={{ 
          display: "inline-block", 
          width: "100%", 
          maxWidth: "728px", 
          height: "90px" 
        }}
        data-ad-client="ca-pub-7209701250707799"
        // Switching format to fluid/rectangle bounds stops tight size constraint rejections
        data-ad-slot="auto" 
        data-full-width-responsive="true"
      />
    </div>
  );
}