"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getAdvertisements } from "@/services/cmsdb";

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
  
  const [ads, setAds] = useState<Ad[]>([]);
  const [showAd, setShowAd] = useState(false);
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);
  const [adCountdown, setAdCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const playedAdsRef = useRef<number[]>([]);
  const prerollPlayedRef = useRef(false);
  
  /* 1. FETCH ADS FROM API */
  useEffect(() => {
    getAdvertisements()
      .then((data) => {
        setAds(data);
      })
      .catch((err) => console.error("Ad Fetch Failed", err))
      .finally(() => setIsLoading(false));
  }, []);

  const TEST_AD_MODE = false;
  const showDebug = false;
  const AD_INTERVAL_MINUTES = 10; 

  /* AD SCHEDULE */
  const adSchedule = useMemo(() => {
    if (TEST_AD_MODE) {
      return [60, 120, 180, 240, 300]; 
    }
    if (!duration) return [];

    const schedule: number[] = [];
    const adCount = Math.floor(duration / (AD_INTERVAL_MINUTES * 60)) || 1;
    const spacing = duration / (adCount + 1);

    for (let i = 1; i <= adCount; i++) {
      schedule.push(Math.floor(spacing * i));
    }
    return schedule;
  }, [duration]);

  /* 2. PREROLL LOGIC */
  useEffect(() => {
    if (!isLoading && ads.length > 0 && !prerollPlayedRef.current) {
      prerollPlayedRef.current = true;
      startAd(ads[0]);
    }
  }, [isLoading, ads]);

  /* 3. MIDROLL LOGIC */
  useEffect(() => {
    if (isLoading || ads.length === 0) return;

    adSchedule.forEach((time) => {
      const alreadyPlayed = playedAdsRef.current.includes(time);

      if (currentTime >= time && !alreadyPlayed) {
        playedAdsRef.current.push(time);
        const randomAd = ads[Math.floor(Math.random() * ads.length)];
        if (randomAd) startAd(randomAd);
      }
    });
  }, [currentTime, adSchedule, ads, isLoading]);

  /* 4. AD TRACKING LOGIC */
  const trackAd = async (adId: number, adDuration: number) => {
    try {
      const currentMovieId = movieData?.id || 0;
      const currentTmdbId = movieData?.id?.toString() || "0";
      
      // We send "0" for viewer_id because the Laravel backend 
      // will overwrite it with $request->ip()
      const currentViewerId = "0";

      const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_URL}/api/track-ad`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_CMS_TOKEN_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          ad_id: adId,
          duration: adDuration,
          movie_id: currentMovieId,
          tmdb_id: currentTmdbId,
          viewer_id: currentViewerId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Ad Tracking Server Error:", errorData);
      } else {
        console.log("Ad tracking successful for Ad ID:", adId);
      }
    } catch (error) {
      console.error("Tracking Network failed", error);
    }
  };

  /* PLAY AD ENGINE */
  const startAd = (ad: Ad) => {
    if (!ad) return;

    const numericDuration = parseInt(ad.duration, 10) || 15; 

    setCurrentAd(ad);
    setShowAd(true);
    setAdCountdown(numericDuration);
    onPauseMovie();

    // CRITICAL: Use 'ad.id' directly from the argument, 
    // NOT 'currentAd.id' because state hasn't updated yet.
    trackAd(ad.id, numericDuration);

    let countdown = numericDuration;
    const timer = setInterval(() => {
      countdown--;
      setAdCountdown(countdown);

      if (countdown <= 0) {
        clearInterval(timer);
        onAdFinished(ad); // Pass the ad to the finish handler
      }
    }, 1000);
  };

  /* CLOSE AD AND RESUME */
  const onAdFinished = (finishedAd?: Ad) => {
    // If you want to track a 'completion' event, use finishedAd or currentAd
    const adToLog = finishedAd || currentAd;
    
    if (adToLog) {
       // Optional: You could call trackAd here too if you want to log "Finished"
       // trackAd(adToLog.id, parseInt(adToLog.duration));
       console.log("Ad sequence finished for:", adToLog.title);
    }

    setShowAd(false);
    setCurrentAd(null);
    onResumeMovie(); 
    // setTimeout(() => { 
     
    // }, 500);
  };

  const nextAdTime = adSchedule.find((time) => time > currentTime) || null;

  return {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
    adSchedule, 
    nextAdTime,
    showDebug,
    isLoading
  };
}