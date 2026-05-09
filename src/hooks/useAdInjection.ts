"use client";



import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ads from "@/config/ads-config.json";

interface Props {
  currentTime: number;

  duration: number;

  onPauseMovie: () => void;

  onResumeMovie: () => void;
}

export default function useAdInjection({
  currentTime,
  duration,
  onPauseMovie,
  onResumeMovie,
}: Props) {
  const [showAd, setShowAd] =
    useState(false);

  const [currentAd, setCurrentAd] =
    useState<any>(null);

  const [adCountdown, setAdCountdown] =
    useState(0);

  const playedAdsRef = useRef<
    number[]
  >([]);

  /* TEST MODE */ 
  const TEST_AD_MODE = true;

  /* AD SCHEDULE */
  
const adSchedule = useMemo(() => {
  /* TEST MODE */
  if (TEST_AD_MODE) {
    return [
      60,  // 1 min
      120, // 2 min
      180, // 3 min
      240, // 4 min
      300, // 5 min
    ];
  }

  /* PRODUCTION MODE */
  if (!duration) return [];

  const schedule: number[] = [];

  /*
    OTT STRATEGY

    20m  -> 1 ad
    60m  -> 2 ads
    120m -> 4 ads
    180m -> 6 ads
  */

  let adCount = 1;

  if (duration >= 3600) {
    adCount = 2;
  }

  if (duration >= 7200) {
    adCount = 4;
  }

  if (duration >= 10800) {
    adCount = 6;
  }

  const spacing =
    duration / (adCount + 1);

  for (
    let i = 1;
    i <= adCount;
    i++
  ) {
    schedule.push(
      Math.floor(spacing * i)
    );
  }

  return schedule;
}, [duration]);

  /* PREROLL */
  useEffect(() => {
    startAd(ads[0]);
  }, []);

  /* MIDROLL */
  useEffect(() => {
    adSchedule.forEach((time) => {
      const alreadyPlayed =
        playedAdsRef.current.includes(
          time
        );

      if (
        currentTime >= time &&
        !alreadyPlayed
      ) {
        playedAdsRef.current.push(
          time
        );

        const randomAd =
          ads[
            Math.floor(
              Math.random() *
                ads.length
            )
          ];

        startAd(randomAd);
      }
    });
  }, [currentTime, adSchedule]);

  /* PLAY AD */
  const startAd = (ad: any) => {
    setCurrentAd(ad);

    setShowAd(true);

    setAdCountdown(ad.duration);

    onPauseMovie();

    let countdown = ad.duration;

    const timer = setInterval(() => {
      countdown--;

      setAdCountdown(countdown);

      if (countdown <= 0) {
        clearInterval(timer);

        setShowAd(false);

        onResumeMovie();
      }
    }, 1000);
  };

  /* MANUAL CLOSE */
  const onAdFinished = () => {
    setShowAd(false);

    onResumeMovie();
  };
const nextAdTime = adSchedule.find( (time) => time > currentTime ) || null;
  return {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
    
    /* DEBUG */ 
    adSchedule, 
    nextAdTime,

  };
}
