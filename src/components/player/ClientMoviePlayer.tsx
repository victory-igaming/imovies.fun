"use client";

import dynamic from "next/dynamic";

const MoviePlayer = dynamic(
  () =>
    import("./MoviePlayer"),
  {
    ssr: false,
  }
);

interface Props {
  movie: any;
}

export default function ClientMoviePlayer({
  movie,
}: Props) {
  return (
    <MoviePlayer movie={movie} />
  );
}

