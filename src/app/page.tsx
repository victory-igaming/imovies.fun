import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import HeroBanner from "@/components/movie/HeroBanner";
import MovieCard from "@/components/movie/MovieCard";

import { getTrendingMovies } from "@/services/tmdb";

export default async function HomePage() {
  const movies = await getTrendingMovies();

  /* SAFE FALLBACK */
  if (!movies || movies.length === 0) {
    return (
      <main className="flex min-h-screen bg-[#050816] text-white">
        <Sidebar />

        <section className="flex-1 md:ml-64">
          <Header />

          <div className="flex items-center justify-center h-[80vh]">
            <div
              className="
                rounded-3xl
                border
                border-white/10
                bg-[#0B1120]
                px-10
                py-8
              "
            >
              <h2 className="text-2xl font-bold">
                Failed to load movies
              </h2>

              <p className="mt-3 text-gray-400">
                Please check your TMDB API key.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const featuredMovie = movies[0];

  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section className="flex-1 md:ml-64 pb-24">
        <Header />

        <div className="p-4 md:p-8">
          {/* HERO */}
          <HeroBanner movie={featuredMovie} />

          {/* MOVIES */}
          <section className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black">
                Trending Movies
              </h2>
            </div>

            <div
              className="
                grid
                grid-cols-2
                sm:grid-cols-3
                md:grid-cols-4
                xl:grid-cols-6
                gap-5
              "
            >
              {movies.map((movie: any) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
