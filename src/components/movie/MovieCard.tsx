"use client";

import Image from "next/image";
import Link from "next/link";

import { motion } from "framer-motion";

import {
  Play,
  Star,
  Clock3,
} from "lucide-react";

import { Movie } from "@/types/movie";

interface Props {
  movie: Movie;
  continueWatching?: boolean;
}

export default function MovieCard({
  movie,
  continueWatching = false,
}: Props) {
  const imageUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/placeholder.jpg";

  const rating = movie.vote_average?.toFixed(1);

  return (
    <Link href={`/movie/${movie.id}`}>
      <motion.div
        whileHover={{
          y: -8,
          scale: 1.04,
        }}
        transition={{
          duration: 0.25,
        }}
        className="
          group
          relative
          overflow-hidden
          rounded-[28px]
          border
          border-white/10
          bg-[#0B1120]
          backdrop-blur-xl
          transition-all
          duration-500
          hover:border-cyan-400/30
          hover:shadow-[0_0_40px_rgba(0,210,255,0.25)]
        "
      >
        {/* IMAGE */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={imageUrl}
            alt={movie.title}
            fill
            priority={false}
            sizes="(max-width:768px) 50vw, 20vw"
            className="
              object-cover
              transition-transform
              duration-700
              group-hover:scale-110
            "
          />

          {/* OVERLAY */}
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-t
              from-black
              via-black/30
              to-transparent
              opacity-0
              group-hover:opacity-100
              transition-all
              duration-500
            "
          />

          {/* PLAY BUTTON */}
          <div
            className="
              absolute
              inset-0
              flex
              items-center
              justify-center
              opacity-0
              group-hover:opacity-100
              transition-all
              duration-500
            "
          >
            <motion.div
              whileHover={{
                scale: 1.1,
              }}
              whileTap={{
                scale: 0.95,
              }}
              className="
                flex
                items-center
                justify-center
                w-20
                h-20
                rounded-full
                bg-gradient-to-r
                from-cyan-400
                to-blue-500
                shadow-[0_0_40px_rgba(0,210,255,0.5)]
              "
            >
              <Play
                size={32}
                fill="black"
                className="ml-1 text-black"
              />
            </motion.div>
          </div>

          {/* TOP BADGES */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {/* HD BADGE */}
            <div
              className="
                rounded-full
                border
                border-cyan-400/20
                bg-cyan-400/10
                px-3
                py-1
                text-xs
                font-semibold
                text-cyan-300
                backdrop-blur-md
              "
            >
              HD
            </div>

            {/* RATING */}
            <div
              className="
                flex
                items-center
                gap-1
                rounded-full
                bg-black/70
                backdrop-blur-md
                px-3
                py-1
                border
                border-white/10
              "
            >
              <Star
                size={14}
                className="text-yellow-400"
                fill="#facc15"
              />

              <span className="text-sm font-semibold text-white">
                {rating}
              </span>
            </div>
          </div>

          {/* CONTINUE WATCHING BAR */}
          {continueWatching && (
            <div className="absolute bottom-0 left-0 w-full">
              <div className="h-1.5 bg-white/10">
                <div className="h-full w-[55%] bg-gradient-to-r from-cyan-400 to-blue-500" />
              </div>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="p-4">
          {/* TITLE */}
          <h3
            className="
              line-clamp-1
              text-sm
              md:text-base
              font-bold
              text-white
            "
          >
            {movie.title}
          </h3>

          {/* INFO */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock3 size={14} />

              <span>
                {movie.release_date?.split("-")[0]}
              </span>
            </div>

            <div
              className="
                rounded-full
                bg-white/5
                border
                border-white/10
                px-2
                py-1
                text-xs
                text-gray-300
              "
            >
              Movie
            </div>
          </div>
        </div>

        {/* GLOW EFFECT */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            rounded-[28px]
            opacity-0
            transition-opacity
            duration-500
            group-hover:opacity-100
            bg-[radial-gradient(circle_at_top,rgba(0,210,255,0.15),transparent_70%)]
          "
        />
      </motion.div>
    </Link>
  );
}