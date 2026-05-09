
"use client";

import MovieCard from "./MovieCard";

interface Props {
  movies: any[];
}

export default function MovieGrid({
  movies,
}: Props) {
  if (!movies?.length) {
    return (
      <div
        className="
          flex
          min-h-[300px]
          items-center
          justify-center
        "
      >
        <p className="text-lg text-gray-400">
          No movies found.
        </p>
      </div>
    );
  }

  return (
    <div
      className="
        grid
        grid-cols-2
        gap-5
        sm:grid-cols-3
        md:grid-cols-4
        lg:grid-cols-5
        xl:grid-cols-6
      "
    >
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
        />
      ))}
    </div>
  );
}
