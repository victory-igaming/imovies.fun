"use client";

import { useEffect, useRef } from "react";

type SidebarGoogleAdProps = {
  clientid: string;
  slotid: string;
  format?: "auto" | "autorelaxed" | "rectangle" | "horizontal" | "vertical";
  responsive?: boolean;
  className?: string;
  minHeight?: number;
};

export default function SidebarGoogleAd({
  clientid,
  slotid,
  format = "auto",
  responsive = true,
  className = "",
  minHeight = 280,
}: SidebarGoogleAdProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!adRef.current) return;
    if (!clientid || !slotid) return;

    const ins = adRef.current;

    const alreadyProcessed =
      ins.getAttribute("data-adsbygoogle-status") ||
      ins.getAttribute("data-ad-status");

    if (alreadyProcessed || pushedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedRef.current = true;
      } catch (error) {
        console.warn("AdSense error:", error);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clientid, slotid, format]);

  if (!clientid || !slotid) {
    return null;
  }

  return (
    <div
      className={`my-4 flex w-full justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2 ${className}`}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "block",
          width: "100%",
          minWidth: "250px",
          minHeight: `${minHeight}px`,
        }}
        data-ad-client={clientid}
        data-ad-slot={slotid}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}