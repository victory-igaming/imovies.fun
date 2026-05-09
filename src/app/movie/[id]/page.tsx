import Image from "next/image";
import Link from "next/link";

import {
  Play,
  Star,
  Clock3,
  Calendar,
  Heart,
  Share2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import { getMovieDetails } from "@/services/tmdb";

interface Props {
  params: {
    id: string;
  };
}

export default async function MovieDetailsPage({
  params,
}: Props) {
  const movie = await getMovieDetails(params.id);

  const backdrop = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;

  const poster = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section className="flex-1 md:ml-64">
        <Header />

        {/* HERO */}
        <section className="relative h-[85vh] min-h-[700px] overflow-hidden">
          {/* BACKDROP */}
          <Image
            src={backdrop}
            alt={movie.title}
            fill
            priority
            className="object-cover"
          />

          {/* OVERLAY */}
          <div className="absolute inset-0 bg-black/70" />

          {/* GRADIENT */}
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-[#050816]
              via-[#050816]/80
              to-transparent
            "
          />

          {/* CONTENT */}
          <div
            className="
              relative
              z-10
              flex
              flex-col
              lg:flex-row
              items-center
              lg:items-end
              gap-10
              h-full
              px-6
              md:px-10
              pb-14
            "
          >
            {/* POSTER */}
            <div
              className="
                relative
                w-[240px]
                md:w-[320px]
                aspect-[2/3]
                overflow-hidden
                rounded-[32px]
                border
                border-white/10
                shadow-[0_0_40px_rgba(0,0,0,0.4)]
              "
            >
              <Image
                src={poster}
                alt={movie.title}
                fill
                className="object-cover"
              />
            </div>

            {/* DETAILS */}
            <div className="max-w-3xl">
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

                <span className="text-sm text-cyan-300 font-medium">
                  Featured Movie
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
                "
              >
                {movie.title}
              </h1>

              {/* META */}
              <div className="flex flex-wrap gap-6 mt-6 text-sm md:text-base">
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

                {/* RUNTIME */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock3 size={16} />

                  <span>{movie.runtime} min</span>
                </div>
              </div>

              {/* GENRES */}
              <div className="flex flex-wrap gap-3 mt-6">
                {movie.genres?.map((genre: any) => (
                  <span
                    key={genre.id}
                    className="
                      rounded-full
                      border
                      border-white/10
                      bg-white/5
                      px-4
                      py-2
                      text-sm
                      text-gray-300
                    "
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* DESCRIPTION */}
              <p
                className="
                  mt-8
                  text-gray-300
                  leading-relaxed
                  text-sm
                  md:text-lg
                  max-w-2xl
                "
              >
                {movie.overview}
              </p>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap gap-4 mt-10">
                {/* PLAY */}
                <Link href={`/watch/${movie.id}`}>
                  <button
                    className="
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

                {/* TRAILER */}
                <button
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    px-8
                    py-4
                    backdrop-blur-xl
                    font-semibold
                    hover:bg-white/10
                    transition-all
                  "
                  aria-label="watch trailer"
                >
                  Watch Trailer
                </button>

                {/* FAVORITE */}
                <button
                  className="
                    flex
                    items-center
                    justify-center
                    w-16
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    backdrop-blur-xl
                    hover:bg-white/10
                    transition-all
                  "
                aria-label="add to favorites"
                >
                  <Heart size={22} />
                </button>

                {/* SHARE */}
                <button
                  className="
                    flex
                    items-center
                    justify-center
                    w-16
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    backdrop-blur-xl
                    hover:bg-white/10
                    transition-all
                  "
                  aria-label="share"
                >
                  <Share2 size={22} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CAST SECTION */}
        <section className="px-6 md:px-10 py-12">
          <h2 className="text-3xl font-black mb-8">
            Cast
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {movie.credits?.cast
              ?.slice(0, 6)
              .map((actor: any) => (
                <div
                  key={actor.id}
                  className="
                    rounded-3xl
                    overflow-hidden
                    border
                    border-white/10
                    bg-[#0B1120]
                  "
                >
                  <div className="relative aspect-[2/3]">
                    <Image
                      src={
                        actor.profile_path
                          ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                          : "/placeholder-user.jpg"
                      }
                      alt={actor.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold line-clamp-1">
                      {actor.name}
                    </h3>

                    <p className="text-sm text-gray-400 line-clamp-1">
                      {actor.character}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </section>
    </main>
  );
}