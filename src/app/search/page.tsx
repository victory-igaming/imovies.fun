"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Search,
  Loader2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import MovieCard from "@/components/movie/MovieCard";

import {
  searchMovies,
  getTrendingMovies,
} from "@/services/tmdb";

import useDebounce from "@/hooks/useDebounce";

export default function SearchPage() {
  const [query, setQuery] =
    useState("");

  const [movies, setMovies] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [trending, setTrending] =
    useState<any[]>([]);

  const debouncedQuery =
    useDebounce(query, 500);

  /* LOAD TRENDING */
  useEffect(() => {
    async function loadTrending() {
      const data =
        await getTrendingMovies();

      setTrending(data);
    }

    loadTrending();
  }, []);

  /* SEARCH */
  useEffect(() => {
    async function fetchMovies() {
      if (!debouncedQuery) {
        setMovies([]);
        return;
      }

      setLoading(true);

      const results =
        await searchMovies(
          debouncedQuery
        );

      setMovies(results);

      setLoading(false);
    }

    fetchMovies();
  }, [debouncedQuery]);

  const displayMovies =
    query.length > 0
      ? movies
      : trending;

  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section className="flex-1 md:ml-64 pb-24">
        <Header />

        <div className="p-4 md:p-8">
          {/* TITLE */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-black">
              Search Movies
            </h1>

            <p className="text-gray-400 mt-3">
              Discover trending movies and
              TV shows.
            </p>
          </div>

          {/* SEARCH BAR */}
          <div
            className="
              relative
              mb-10
              max-w-3xl
            "
          >
            {/* ICON */}
            <Search
              size={22}
              className="
                absolute
                left-5
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />

            {/* INPUT */}
            <input
              type="text"
              placeholder="Search movies, TV shows..."
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              className="
                w-full
                rounded-3xl
                border
                border-white/10
                bg-white/5
                py-5
                pl-14
                pr-6
                text-lg
                text-white
                outline-none
                backdrop-blur-xl
                transition-all
                duration-300
                placeholder:text-gray-500
                focus:border-cyan-400/50
                focus:bg-white/10
                focus:shadow-[0_0_30px_rgba(0,210,255,0.15)]
              "
            />
          </div>

          {/* SEARCH STATE */}
          <div className="mb-8">
            {query ? (
              <h2 className="text-2xl font-bold">
                Results for "
                <span className="text-cyan-400">
                  {query}
                </span>
                "
              </h2>
            ) : (
              <h2 className="text-2xl font-bold">
                Trending Movies
              </h2>
            )}
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex justify-center py-20">
              <Loader2
                className="
                  animate-spin
                  text-cyan-400
                "
                size={48}
              />
            </div>
          )}

          {/* EMPTY */}
          {!loading &&
            query &&
            movies.length === 0 && (
              <div
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  py-20
                  text-center
                "
              >
                <Search
                  size={60}
                  className="text-gray-600"
                />

                <h3 className="mt-6 text-2xl font-bold">
                  No Results Found
                </h3>

                <p className="mt-2 text-gray-400">
                  Try another search term.
                </p>
              </div>
            )}

          {/* MOVIE GRID */}
          {!loading &&
            displayMovies.length > 0 && (
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
                {displayMovies.map(
                  (movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                    />
                  )
                )}
              </div>
            )}
        </div>
      </section>
    </main>
  );
}