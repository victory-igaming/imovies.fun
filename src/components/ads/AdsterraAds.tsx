// src/components/ads/AdsterraAds.tsx

"use client";

import PopunderAd from "@/components/ads/PopunderAd";
import SocialBarAd from "@/components/ads/SocialBarAd";
import Banner160x300Ad from "@/components/ads/Banner160x300Ad";
import NativeBannerAd from "@/components/ads/NativeBannerAd";
import SmartlinkAd from "@/components/ads/SmartlinkAd";
import Banner320x50Ad from "@/components/ads/Banner320x50Ad";

type AdsterraAdsProps = {
  showBackgroundAds?: boolean;
  showSidebarAds?: boolean;
  showMobileBanner?: boolean;
  smartlinkUrl?: string;
};

export default function AdsterraAds({
  showBackgroundAds = true,
  showSidebarAds = true,
  showMobileBanner = false,
  smartlinkUrl,
}: AdsterraAdsProps) {
  return (
    <>
      {showBackgroundAds && (
        <>
          <PopunderAd />
          <SocialBarAd />
        </>
      )}

      {showSidebarAds && (
        <>
          <Banner160x300Ad />
          <NativeBannerAd />
          <SmartlinkAd href={smartlinkUrl} />
        </>
      )}

      {showMobileBanner && <Banner320x50Ad />}
    </>
  );
}