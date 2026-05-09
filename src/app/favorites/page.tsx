"use client";

import {
  useEffect,
  useState,
} from "react";

import AppShell from "@/components/layout/AppShell";

import MovieCard from "@/components/movie/MovieCard";

import { useFavoritesStore } from "@/store/favorites.store";

const API_KEY =
  process.env.NEXT_PUBLIC_TMDB_API_KEY;

export default function FavoritesPage() {
  const { favorites } =
    useFavoritesStore();

  const [movies, setMovies] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadMovies() {
      try {
        const results =
          await Promise.all(
            favorites.map(async (id) => {
              const res = await fetch(
                `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}`
              );

              return res.json();
            })
          );

        setMovies(results);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadMovies();
  }, [favorites]);

  return (
    <AppShell>
      {/* TITLE */}
      <div className="mb-10">
        <h1 className="text-5xl font-black">
          Favorites
        </h1>

        <p className="mt-3 text-gray-400">
          Your saved movies and
          watchlist.
        </p>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="py-20 text-center">
          Loading favorites...
        </div>
      )}

      {/* EMPTY */}
      {!loading &&
        movies.length === 0 && (
          <div
            className="
              flex
              min-h-[50vh]
              flex-col
              items-center
              justify-center
              rounded-3xl
              border
              border-white/10
              bg-[#0B1120]
              text-center
            "
          >
            <h2 className="text-3xl font-black">
              No Favorites Yet
            </h2>

            <p className="mt-4 text-gray-400">
              Start adding movies to your
              watchlist.
            </p>
          </div>
        )}

      {/* GRID */}
      {movies.length > 0 && (
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
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
