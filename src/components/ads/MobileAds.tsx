import AdsterraAds from "@/components/ads/AdsterraAds";

export default function MobileAds() {
  return (
    <AdsterraAds
      showBackgroundAds={false}
      showSidebarAds={false}
      showMobileBanner={true}
    />
  );
}