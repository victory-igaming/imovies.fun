"use client";

import Link from "next/link";

import Image from "next/image";

import { Heart } from "lucide-react";

import { useFavoritesStore } from "@/store/favorites.store";

interface Props {
  movie: any;
  priority?: boolean;
}

export default function MovieCard({ movie, priority = false }: Props) {

  const { toggleFavorite, isFavorite } = useFavoritesStore();

  const favorite = isFavorite(movie.id);

  return (
    <div
      className="
        group
        relative
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-[#0B1120]
        transition-all
        duration-300
        hover:-translate-y-2
        hover:border-cyan-400/30
      "
    >
      {/* FAVORITE BUTTON */}
      <button
        onClick={() => toggleFavorite(movie)}
        className="
          absolute
          right-3
          top-3
          z-20
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          bg-black/60
          backdrop-blur-xl
        "
        title="Favorite"
        suppressHydrationWarning={true}
        
      >
        <Heart
          size={20}
          className={favorite ? "fill-red-500 text-red-500" : "text-white"}
        />
      </button>

      <Link href={`/movie/${movie.id}`}>
        <div className="relative aspect-[2/3]">
          <Image
            src={
              movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : "/placeholders/poster.jpg"
            }
            alt={movie?.title || "Movie Backdrop"}
            fill
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes=" (max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw "
            className="object-cover"
          />
        </div>

        <div className="p-4">
          <h3 className="line-clamp-1 font-bold">{movie.title}</h3>

          <p className="mt-2 text-sm text-gray-400">
            {movie.release_date?.split("-")[0]}
          </p>
        </div>
      </Link>
    </div>
  );
}
