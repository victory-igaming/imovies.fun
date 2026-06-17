"use client";

import {
  useEffect,
  useRef,
} from "react";

interface Props {
  loadMore: () => void;

  hasMore: boolean;

  loading: boolean;
}

export default function InfiniteScroll({
  loadMore,
  hasMore,
  loading,
}: Props) {
  const loaderRef =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    const observer =
      new IntersectionObserver(
        (entries) => {
          const target =
            entries[0];

          if (
            target.isIntersecting &&
            hasMore &&
            !loading
          ) {
            loadMore();
          }
        },
        {
          threshold: 1,
        }
      );

    if (loaderRef.current) {
      observer.observe(
        loaderRef.current
      );
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(
          loaderRef.current
        );
      }
    };
  }, [
    hasMore,
    loading,
    loadMore,
  ]);

  return (
    <div
      ref={loaderRef}
      className="
        flex
        items-center
        justify-center
        py-10
      "
    >
      {loading && (
        <div
          className="
            h-12
            w-12
            animate-spin
            rounded-full
            border-4
            border-cyan-400/20
            border-t-cyan-400
          "
        />
      )}

      {!hasMore && (
        <p className="text-gray-500">
          No more movies
        </p>
      )}
    </div>
  );
}