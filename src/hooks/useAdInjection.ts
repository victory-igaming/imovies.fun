"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAdvertisements } from "@/services/cmsdb";


// This strips any trailing slashes and ensures a hard default to localhost if the env file fails to read
const CMS_URL = (process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:8000").replace(/\/$/, "");
const CMS_TOKEN = process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;

interface Ad {
  id: number;
  title: string;
  videoUrl: string;
  duration: string;
}

interface Props {
  currentTime: number;
  duration: number;
  movieData?: any;
  onPauseMovie: () => void;
  onResumeMovie: () => void;
}

export default function useAdInjection({
  currentTime,
  duration,
  movieData,
  onPauseMovie,
  onResumeMovie,
}: Props) {
  const [ads,          setAds]          = useState<Ad[]>([]);
  const [showAd,       setShowAd]       = useState(false);
  const [adReady,      setAdReady]      = useState(false);
  const [currentAd,    setCurrentAd]    = useState<Ad | null>(null);
  const [adCountdown,  setAdCountdown]  = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);

  const playedAdsRef     = useRef<number[]>([]);
  const prerollPlayedRef = useRef(false);
  const adTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const TEST_AD_MODE      = process.env.NEXT_PUBLIC_TEST_AD_MODE === "true";
  const showDebug         = process.env.NEXT_PUBLIC_NODE_ENV === "development";
  const AD_INTERVAL_MINUTES = 10;

  // ── 1. Fetch ads ──────────────────────────────────────────────────────────
  useEffect(() => {
    getAdvertisements()
      .then(setAds)
      .catch((err) => console.error("Ad Fetch Failed", err))
      .finally(() => setIsLoading(false));
  }, []);

  // ── Ad schedule ───────────────────────────────────────────────────────────
  const adSchedule = useMemo(() => {
    if (TEST_AD_MODE) return [60, 120, 180, 240, 300];
    if (!duration) return [];

    const adCount = Math.floor(duration / (AD_INTERVAL_MINUTES * 60)) || 1;
    const spacing = duration / (adCount + 1);
    return Array.from({ length: adCount }, (_, i) => Math.floor(spacing * (i + 1)));
  }, [duration, TEST_AD_MODE]);

  // ── Track ad view ─────────────────────────────────────────────────────────
  const trackAd = async (adId: number, adDuration: number) => {
    // Safely retrieve token from client storage
    
    try {
      const response = await fetch(`${CMS_URL}/api/track-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "Accept": "application/json",
          // Pass the dynamic auth token header directly to the api proxy route
          "Authorization": `Bearer ${CMS_TOKEN}`
         },
        body: JSON.stringify({
          ad_id:     adId,
          duration:  adDuration,
          movie_id:  movieData?.id || 0,
          tmdb_id:   movieData?.id?.toString() || "0",
          viewer_id: "0",
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        try { console.error("Ad Tracking Error:", JSON.parse(text)); }
        catch { console.error(`Ad Tracking Error (${response.status}):`, text); }
      } else {
        const data = await response.json().catch(() => ({ status: "success" }));
        console.log("Ad tracked — ID:", adId, data);
      }
    } catch (err) {
      console.error("Ad tracking network error:", err);
    }
  };

  // ── Play ad engine ────────────────────────────────────────────────────────
  const startAd = (ad: Ad) => {
    if (!ad) return;
    if (adTimerRef.current) clearInterval(adTimerRef.current);

    const numericDuration = parseInt(ad.duration, 10) || 15;

    setCurrentAd(ad);
    setShowAd(true);
    setAdCountdown(numericDuration);
    setAdReady(false);
    onPauseMovie();

    trackAd(ad.id, numericDuration);

    let countdown = numericDuration;
    adTimerRef.current = setInterval(() => {
      countdown--;
      setAdCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(adTimerRef.current!);
        adTimerRef.current = null;
        finishAd(ad);
      }
    }, 1000);
  };

  const finishAd = (finishedAd?: Ad) => {
    const ad = finishedAd || currentAd;
    if (ad) console.log("Ad finished:", ad.title);
    if (adTimerRef.current) { clearInterval(adTimerRef.current); adTimerRef.current = null; }
    setShowAd(false);
    setCurrentAd(null);
    onResumeMovie();
  };

  // ── 2. Preroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && ads.length > 0 && !prerollPlayedRef.current) {
      prerollPlayedRef.current = true;
      startAd(ads[0]!);
    }
  }, [isLoading, ads]); // eslint-disable-line

  // ── 3. Midroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || ads.length === 0) return;

    for (const time of adSchedule) {
      if (currentTime >= time && !playedAdsRef.current.includes(time)) {
        playedAdsRef.current.push(time);
        const randomAd = ads[Math.floor(Math.random() * ads.length)]!;
        startAd(randomAd);
        break; // only one ad per tick
      }
    }
  }, [currentTime]); // eslint-disable-line

  useEffect(() => () => {
    if (adTimerRef.current) clearInterval(adTimerRef.current);
  }, []);

  const nextAdTime = adSchedule.find((t) => t > currentTime) ?? null;

  return {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished: finishAd,
    onAdReady: () => setAdReady(true),
    adSchedule,
    nextAdTime,
    showDebug,
    isLoading,
  };
}
