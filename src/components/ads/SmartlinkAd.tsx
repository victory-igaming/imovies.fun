// src/components/ads/SmartlinkAd.tsx

"use client";

const DEFAULT_SMARTLINK_URL =
  "https://www.effectivecpmnetwork.com/s512nswxq?key=32ec5d055928286a4d3c9986a7a1e9b2";

type SmartlinkAdProps = {
  text?: string;
  href?: string;
  className?: string;
};

export default function SmartlinkAd({
  text = "Continue Watching",
  href = DEFAULT_SMARTLINK_URL,
  className = "",
}: SmartlinkAdProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={`my-4 flex min-h-[80px] w-full items-center justify-center rounded-[22px] border border-red-500/30 bg-red-600/20 px-4 text-center text-sm font-semibold text-white transition hover:bg-red-600/30 ${className}`}
    >
      {text}
    </a>
  );
}