// src/components/ads/SidebarAdsterraNative.tsx

"use client";

import { useEffect, useRef, useState } from "react";

type AdSlotId =
  | "29543407"
  | "29543408"
  | "29543409"
  | "29543410"
  | "banner-320x50"
  | "banner-160x300";

type SidebarAdsterraNativeProps = {
  slotid: AdSlotId;
  className?: string;
  minHeight?: number;
  showPlaceholder?: boolean;
};

const ADSTERRA_UNITS: Record<
  AdSlotId,
  {
    name: string;
    type:
      | "popunder"
      | "native"
      | "smartlink"
      | "socialbar"
      | "iframe-banner";
    script?: string;
    link?: string;
    containerId?: string;
    visibleBox: boolean;
    note: string;
    bannerKey?: string;
    width?: number;
    height?: number;
  }
> = {
  "29543407": {
    name: "Popunder",
    type: "popunder",
    script:
      "https://pl29643906.effectivecpmnetwork.com/a4/2c/af/a42cafeb36fa124d3219930d9d8c6b9f.js",
    visibleBox: false,
    note: "Popunder loaded",
  },

  "29543408": {
    name: "Native Banner",
    type: "native",
    script:
      "https://pl29643907.effectivecpmnetwork.com/e3dbe930f0fe534d9aaad69bea6d7030/invoke.js",
    containerId: "container-e3dbe930f0fe534d9aaad69bea6d7030",
    visibleBox: true,
    note: "Advertisement",
  },

  "29543409": {
    name: "Smartlink",
    type: "smartlink",
    link:
      "https://www.effectivecpmnetwork.com/g0aewscbzh?key=40c584303dd7ebc6b62464e347bd9490",
    visibleBox: true,
    note: "Continue Watching",
  },

  "29543410": {
    name: "Social Bar",
    type: "socialbar",
    script:
      "https://pl29643909.effectivecpmnetwork.com/2a/93/5a/2a935ab004e0f0f4de37620e48033355.js",
    visibleBox: false,
    note: "Social Bar loaded",
  },

  "banner-320x50": {
    name: "Banner 320x50",
    type: "iframe-banner",
    script:
      "https://www.highperformanceformat.com/0b378a95942a92ed9b80ca2df608f1e4/invoke.js",
    bannerKey: "0b378a95942a92ed9b80ca2df608f1e4",
    width: 320,
    height: 50,
    visibleBox: true,
    note: "Advertisement",
  },

  "banner-160x300": {
    name: "Banner 160x300",
    type: "iframe-banner",
    script:
      "https://www.highperformanceformat.com/2ed003bd7bbd57c5dd8aefd40e4d6bf0/invoke.js",
    bannerKey: "2ed003bd7bbd57c5dd8aefd40e4d6bf0",
    width: 160,
    height: 300,
    visibleBox: true,
    note: "Advertisement",
  },
};

export default function SidebarAdsterraNative({
  slotid,
  className = "",
  minHeight,
  showPlaceholder = false,
}: SidebarAdsterraNativeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  const adUnit = ADSTERRA_UNITS[slotid];

  const finalMinHeight =
    minHeight || adUnit.height || 280;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!adUnit) return;

    if (adUnit.type === "smartlink") return;
    if (!adUnit.script) return;

    const container = containerRef.current;

    if (adUnit.type === "iframe-banner") {
      if (!container) return;

      container.innerHTML = "";

      const optionsScript = document.createElement("script");
      optionsScript.type = "text/javascript";
      optionsScript.innerHTML = `
        atOptions = {
          'key' : '${adUnit.bannerKey}',
          'format' : 'iframe',
          'height' : ${adUnit.height},
          'width' : ${adUnit.width},
          'params' : {}
        };
      `;

      const invokeScript = document.createElement("script");
      invokeScript.src = adUnit.script;
      invokeScript.type = "text/javascript";
      invokeScript.async = true;
      invokeScript.dataset.slotid = slotid;

      invokeScript.onload = () => {
        console.log(`[Adsterra] ${adUnit.name} loaded`);
        setFailed(false);
      };

      invokeScript.onerror = () => {
        console.warn(`[Adsterra] ${adUnit.name} failed to load`);
        setFailed(true);
      };

      container.appendChild(optionsScript);
      container.appendChild(invokeScript);

      return () => {
        container.innerHTML = "";
      };
    }

    const existingScript = document.querySelector(
      `script[src="${adUnit.script}"]`
    );

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = adUnit.script;
    script.async = true;
    script.type = "text/javascript";
    script.dataset.slotid = slotid;

    if (adUnit.type === "native") {
      script.setAttribute("data-cfasync", "false");
    }

    script.onload = () => {
      console.log(`[Adsterra] ${adUnit.name} loaded`);
      setFailed(false);
    };

    script.onerror = () => {
      console.warn(`[Adsterra] ${adUnit.name} failed to load`);
      setFailed(true);
    };

    document.body.appendChild(script);
  }, [slotid, adUnit]);

  if (!adUnit) return null;

  if (!adUnit.visibleBox && !showPlaceholder) {
    return null;
  }

  if (adUnit.type === "smartlink") {
    return (
      <div
        className={`my-4 w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2 ${className}`}
        style={{ minHeight: finalMinHeight }}
        data-adsterra-slot={slotid}
        data-adsterra-type={adUnit.type}
      >
        <a
          href={adUnit.link}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="flex w-full items-center justify-center rounded-[22px] border border-red-500/30 bg-red-600/20 px-4 text-center text-sm font-semibold text-white transition hover:bg-red-600/30"
          style={{ minHeight: finalMinHeight - 20 }}
        >
          {adUnit.note}
        </a>
      </div>
    );
  }

  if (adUnit.type === "native") {
    return (
      <div
        ref={containerRef}
        className={`my-4 w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2 ${className}`}
        style={{ minHeight: finalMinHeight }}
        data-adsterra-slot={slotid}
        data-adsterra-type={adUnit.type}
      >
        {failed ? (
          <div
            className="flex w-full items-center justify-center rounded-[22px] border border-white/10 bg-black/20 px-4 text-center text-xs text-white/40"
            style={{ minHeight: finalMinHeight - 20 }}
          >
            Advertisement failed to load
          </div>
        ) : (
          <div
            id={adUnit.containerId}
            className="w-full overflow-hidden rounded-[22px]"
            style={{ minHeight: finalMinHeight - 20 }}
          />
        )}
      </div>
    );
  }

  if (adUnit.type === "iframe-banner") {
    return (
      <div
        className={`my-4 flex w-full justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2 ${className}`}
        style={{ minHeight: finalMinHeight + 20 }}
        data-adsterra-slot={slotid}
        data-adsterra-type={adUnit.type}
      >
        {failed ? (
          <div
            className="flex w-full items-center justify-center rounded-[22px] border border-white/10 bg-black/20 px-4 text-center text-xs text-white/40"
            style={{ minHeight: finalMinHeight }}
          >
            Advertisement failed to load
          </div>
        ) : (
          <div
            ref={containerRef}
            className="flex w-full items-center justify-center overflow-hidden rounded-[22px]"
            style={{
              width: "100%",
              minHeight: finalMinHeight,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`my-4 flex w-full justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-2 ${className}`}
      style={{ minHeight: finalMinHeight }}
      data-adsterra-slot={slotid}
      data-adsterra-type={adUnit.type}
    >
      <div
        className="flex w-full items-center justify-center rounded-[22px] border border-white/10 bg-black/20 px-4 text-center text-xs text-white/40"
        style={{ minHeight: finalMinHeight - 20 }}
      >
        {failed ? `${adUnit.name} failed to load` : adUnit.note}
      </div>
    </div>
  );
}