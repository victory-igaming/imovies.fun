import AppShell from "@/components/layout/AppShell";

import MovieCard from "@/components/movie/MovieCard";

import HeroBanner from "@/components/movie/HeroBanner";

import {
  getTrendingMovies,
} from "@/services/tmdb";

export default async function TrendingPage() {
  const movies =
    await getTrendingMovies();

  /* EMPTY */
  if (!movies?.length) {
    return (
      <AppShell>
        <div
          className="
            flex
            min-h-[70vh]
            items-center
            justify-center
          "
        >
          <div
            className="
              rounded-3xl
              border
              border-white/10
              bg-white/[0.03]
              p-10
              text-center
            "
          >
            <h2 className="text-4xl font-black">
              No Trending Movies
            </h2>

            <p className="mt-4 text-gray-400">
              Please try again later.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>    
       

      {/* HEADER */}
      <div
        className="
          mt-14
          mb-8
          flex
          items-center
          justify-between
        "
      >
        <div>
          <h1
            className="
              text-4xl
              font-black
              md:text-5xl
            "
          >
            Trending Now
          </h1>

          <p className="mt-3 text-gray-400">
            Most watched movies this week
          </p>
        </div>

        {/* LIVE BADGE */}
        <div
          className="
            hidden
            items-center
            gap-2
            rounded-full
            border
            border-red-500/20
            bg-red-500/10
            px-5
            py-3
            text-sm
            font-semibold
            text-red-300
            md:flex
          "
        >
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />

          LIVE TRENDING
        </div>
      </div>

      {/* GRID */}
      <section
        className="
          grid
          grid-cols-2
          gap-5
          md:grid-cols-4
          lg:grid-cols-6
        "
      >
        {movies.map(
          (movie: any, index: number) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              priority={index < 2}
            />
          )
        )}
      </section>
    </AppShell>
  );
}
