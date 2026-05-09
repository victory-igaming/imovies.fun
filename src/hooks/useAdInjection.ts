"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ads from "@/config/ads-config.json";

interface Ad {
  id: number;
  title: string;
  videoUrl: string;
  duration: number;
}

interface Props {
  currentTime: number;
  onPauseMovie: () => void;
  onResumeMovie: () => void;
}

export default function useAdInjection({
  currentTime,
  onPauseMovie,
  onResumeMovie,
}: Props) {
  const [showAd, setShowAd] = useState(false);

  const [currentAd, setCurrentAd] =
    useState<Ad | null>(null);

  const [adCountdown, setAdCountdown] =
    useState(10);

  const adTimerRef = useRef<NodeJS.Timeout>();

  const lastAdBreakRef = useRef(0);

  const adPlayingRef = useRef(false);

  const tabVisibleRef = useRef(true);

  /* RANDOM AD */
  const getRandomAd = useCallback(() => {
    const randomIndex = Math.floor(
      Math.random() * ads.length
    );

    return ads[randomIndex];
  }, []);

  /* START AD */
  const startAd = useCallback(() => {
    if (adPlayingRef.current) return;

    adPlayingRef.current = true;

    const selectedAd = getRandomAd();

    setCurrentAd(selectedAd);

    setShowAd(true);

    setAdCountdown(selectedAd.duration);

    onPauseMovie();

    let remaining = selectedAd.duration;

    adTimerRef.current = setInterval(() => {
      if (!tabVisibleRef.current) return;

      remaining--;

      setAdCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(adTimerRef.current);

        setShowAd(false);

        setCurrentAd(null);

        adPlayingRef.current = false;

        onResumeMovie();
      }
    }, 1000);
  }, [
    getRandomAd,
    onPauseMovie,
    onResumeMovie,
  ]);

  /* END AD MANUALLY */
  const onAdFinished = useCallback(() => {
    clearInterval(adTimerRef.current);

    setShowAd(false);

    setCurrentAd(null);

    adPlayingRef.current = false;

    onResumeMovie();
  }, [onResumeMovie]);

  /* CHECK AD BREAK */
  useEffect(() => {
    if (showAd) return;

    const nextBreak =
      lastAdBreakRef.current + 90;

    if (
      currentTime >= nextBreak &&
      currentTime > 0
    ) {
      lastAdBreakRef.current = currentTime;

      startAd();
    }
  }, [currentTime, showAd, startAd]);

  /* TAB VISIBILITY */
  useEffect(() => {
    const handleVisibility = () => {
      tabVisibleRef.current =
        !document.hidden;
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  /* CLEANUP */
  useEffect(() => {
    return () => {
      clearInterval(adTimerRef.current);
    };
  }, []);

  return {
    showAd,
    currentAd,
    adCountdown,
    onAdFinished,
  };
}