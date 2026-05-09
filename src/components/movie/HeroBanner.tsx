"use client";

import Image from "next/image";
import Link from "next/link";

import { motion } from "framer-motion";

import {
  Play,
  Star,
  Calendar,
} from "lucide-react";

import { Movie } from "@/types/movie";

interface Props {
  movie: Movie;
}

export default function HeroBanner({
  movie,
}: Props) {
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : "/placeholder-backdrop.jpg";

  return (
    <section className="relative w-full h-[75vh] min-h-[600px] overflow-hidden rounded-[32px]">
      {/* BACKDROP IMAGE */}
      <Image
        src={backdropUrl}
        alt={movie.title}
        fill
        priority
        className="object-cover"
      />

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/60" />

      {/* CINEMATIC GRADIENT */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-r
          from-[#050816]
          via-[#050816]/70
          to-transparent
        "
      />

      {/* BOTTOM FADE */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-[#050816]
          via-transparent
          to-transparent
        "
      />

      {/* CONTENT */}
      <motion.div
        initial={{
          opacity: 0,
          y: 40,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.8,
        }}
        className="
          absolute
          z-10
          bottom-0
          left-0
          w-full
          p-6
          md:p-12
        "
      >
        <div className="max-w-2xl">
          {/* BADGE */}
          <div
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-cyan-400/20
              bg-cyan-400/10
              px-4
              py-2
              backdrop-blur-md
              mb-5
            "
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />

            <span className="text-sm font-medium text-cyan-300">
              Trending Now
            </span>
          </div>

          {/* TITLE */}
          <h1
            className="
              text-4xl
              md:text-7xl
              font-black
              leading-tight
              tracking-tight
              text-white
            "
          >
            {movie.title}
          </h1>

          {/* META */}
          <div className="flex flex-wrap items-center gap-5 mt-6 text-sm md:text-base">
            {/* RATING */}
            <div className="flex items-center gap-2">
              <Star
                size={18}
                className="text-yellow-400"
                fill="#facc15"
              />

              <span className="font-semibold">
                {movie.vote_average?.toFixed(1)}
              </span>
            </div>

            {/* YEAR */}
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar size={16} />

              <span>
                {movie.release_date?.split("-")[0]}
              </span>
            </div>

            {/* QUALITY */}
            <div
              className="
                rounded-full
                border
                border-cyan-400/20
                bg-cyan-400/10
                px-3
                py-1
                text-cyan-300
                text-sm
              "
            >
              4K Ultra HD
            </div>
          </div>

          {/* DESCRIPTION */}
          <p
            className="
              mt-6
              text-gray-300
              text-sm
              md:text-lg
              leading-relaxed
              max-w-xl
              line-clamp-3
            "
          >
            {movie.overview}
          </p>

          {/* BUTTONS */}
          <div className="flex flex-wrap gap-4 mt-8">
            {/* PLAY BUTTON */}
            <Link href={`/watch/${movie.id}`}>
              <button
                className="
                  group
                  flex
                  items-center
                  gap-3
                  rounded-2xl
                  bg-gradient-to-r
                  from-cyan-400
                  to-blue-500
                  px-8
                  py-4
                  font-bold
                  text-black
                  shadow-[0_0_30px_rgba(0,210,255,0.35)]
                  transition-all
                  duration-300
                  hover:scale-105
                "
              >
                <Play
                  size={22}
                  fill="black"
                />

                Play Now
              </button>
            </Link>

            {/* TRAILER BUTTON */}
            <button
              className="
                rounded-2xl
                border
                border-white/10
                bg-white/5
                backdrop-blur-md
                px-8
                py-4
                font-semibold
                text-white
                transition-all
                duration-300
                hover:bg-white/10
              "
            >
              Watch Trailer
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}