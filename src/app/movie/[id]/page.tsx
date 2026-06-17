import Image from "next/image";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import TrailerButton from "@/components/movie/TrailerButton";
import AdsterraAds from "@/components/ads/AdsterraAds";

import { getOrSyncMovie } from "@/services/cmsdb";
import { getMovieDetails } from "@/services/tmdb";
import { getMovieBlogs } from "@/services/cmsdb";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function MovieDetailsPage({ params }: Props) {
  const { id } = await params;

  const [tmdbMovie, syncedMovie, movieBlogs] = await Promise.all([
    getMovieDetails(id),
    getOrSyncMovie(id),
    getMovieBlogs(id),
  ]);

  //console.log("Movie Blogs:", movieBlogs);
  const blogs = Array.isArray(movieBlogs) ? movieBlogs : [];

  if (!tmdbMovie || tmdbMovie.success === false) {
    return (
      <AppShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-10 text-center">
            <h2 className="text-3xl font-black">Movie Not Found</h2>
            <p className="mt-4 text-gray-400">
              This movie does not exist.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const movie = {
    ...tmdbMovie,
    ...syncedMovie,
    id: tmdbMovie.id || syncedMovie?.tmdb_id,
    title: tmdbMovie.title || syncedMovie?.title,
    overview: tmdbMovie.overview || syncedMovie?.overview,
    poster_path: tmdbMovie.poster_path || syncedMovie?.poster_path,
    backdrop_path: tmdbMovie.backdrop_path || syncedMovie?.backdrop_path,
    release_date: tmdbMovie.release_date || syncedMovie?.release_date,
    runtime: tmdbMovie.runtime || syncedMovie?.runtime,
    trailerKey:
      tmdbMovie.trailerKey ||
      tmdbMovie.trailer_key ||
      syncedMovie?.trailer_key,
  };

  const backdrop = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : "/placeholders/backdrop.jpg";

  const poster = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/placeholders/poster.jpg";

  return (
    <AppShell>
      <section className="relative h-[85vh] min-h-[700px] overflow-hidden rounded-[32px]">
        <Image
          src={backdrop}
          alt={movie.title || "Movie Backdrop"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-black/40 to-black/20" />

        <div className="absolute bottom-0 z-10 flex w-full flex-col gap-8 p-8 md:flex-row md:items-end">
          <div className="relative h-[420px] w-[280px] overflow-hidden rounded-3xl border border-white/10">
            <Image
              src={poster}
              alt={movie.title || "Movie Poster"}
              fill
              sizes="280px"
              className="object-cover"
            />
          </div>

          <div className="max-w-3xl">
            <h1 className="text-5xl font-black md:text-7xl">
              {movie.title}
            </h1>

            <p className="mt-6 text-lg text-gray-300">
              {movie.overview}
            </p>

            <div className="mt-8 flex gap-4">
              <Link href={`/watch/${movie.id}`} className="btn-primary">
                Play Now
              </Link>

              <TrailerButton
                trailerKey={movie.trailerKey}
                title={movie.title}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[32px] border border-white/5 bg-white/[0.02] px-6 py-12 backdrop-blur-xl md:px-10">
        <h2 className="mb-8 text-3xl font-black">Cast</h2>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
          {tmdbMovie.credits?.cast?.slice(0, 6).map((actor: any) => (
            <div
              key={actor.id}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0B1120] transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/30 hover:shadow-glow"
            >
              <Link href={`/actor/${actor.id}`}>
                <div className="relative aspect-[2/3]">
                  <Image
                    src={
                      actor.profile_path
                        ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                        : "/placeholder-user.jpg"
                    }
                    alt={actor.name || "Actor"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover"
                  />
                </div>
              </Link>

              <div className="p-4">
                <h3 className="line-clamp-1 font-semibold">
                  {actor.name}
                </h3>

                <p className="line-clamp-1 text-sm text-gray-400">
                  {actor.character}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* MOVIE BLOGS */}
{blogs.length > 0 && (
  <section
    className="
      mt-10
      rounded-[32px]
      border
      border-white/10
      bg-[#07101f]
      p-8
    "
  >
    <h2
      className="
        mb-8
        text-4xl
        font-black
      "
    >
      Movie Articles & Reviews
    </h2>

    <div className="space-y-10">
      {movieBlogs.map((blog: any) => (
        <article
          key={blog.id}
          className="
            rounded-3xl
            border
            border-white/10
            bg-white/[0.03]
            overflow-hidden
          "
        >
          {blog.image && (
            <img
              src={`${process.env.NEXT_PUBLIC_CMS_URL}/storage/${blog.image}`}
              alt={blog.title}
              className="
                h-[350px]
                w-full
                object-cover
              "
            />
          )}

          <div className="p-8">
            <div
              className="
                mb-4
                flex
                flex-wrap
                gap-3
              "
            >
              <span
                className="
                  rounded-full
                  bg-cyan-500/20
                  px-4
                  py-1
                  text-sm
                  text-cyan-300
                "
              >
                {blog.category}
              </span>

              <span className="text-gray-400">
                {blog.genre}
              </span>

              <span className="text-gray-400">
                {blog.release_date}
              </span>
            </div>

            <h3
              className="
                mb-4
                text-3xl
                font-black
              "
            >
              {blog.title}
            </h3>

            <div
              className="
                prose
                prose-invert
                max-w-none
                text-gray-300
              "
              dangerouslySetInnerHTML={{
                __html: blog.content,
              }}
            />

            <div
              className="
                mt-8
                flex
                flex-wrap
                gap-6
                text-sm
                text-gray-400
              "
            >
              <span>
                Director: {blog.director}
              </span>

              <span>
                Author: {blog.author}
              </span>

              <span>
                Profit: {blog.profit}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  </section>
)}

  
    </AppShell>
  );
}