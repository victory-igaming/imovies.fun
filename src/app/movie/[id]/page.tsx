import Image from "next/image";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import TrailerButton from "@/components/movie/TrailerButton";

import {
  getMovieDetails,
} from "@/services/tmdb";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function MovieDetailsPage({
  params,
}: Props) {
  /* NEXT 16 FIX */
  const { id } = await params;

  /* FETCH MOVIE */
  const movie =
    await getMovieDetails(id);

  /* INVALID MOVIE */
  if (
    !movie ||
    movie.success === false
  ) {
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
              border-red-500/20
              bg-red-500/10
              p-10
              text-center
            "
          >
            <h2 className="text-3xl font-black">
              Movie Not Found
            </h2>

            <p className="mt-4 text-gray-400">
              This movie does not exist.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  /* SAFE IMAGES */
  const backdrop =
    movie.backdrop_path
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
      : "/placeholders/backdrop.jpg";

  const poster =
    movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "/placeholders/poster.jpg";

  return (
    <AppShell>
      {/* HERO */}
      <section
        className="
          relative
          h-[85vh]
          min-h-[700px]
          overflow-hidden
          rounded-[32px]
        "
      >
        {/* BACKDROP */}
        <Image
          src={backdrop}
          alt={
            movie.title ||
            "Movie Backdrop"
          }
          fill
          priority
          loading="eager"
          sizes="100vw"
          className="object-cover"
        />

        {/* OVERLAY */}
        <div
          className="
            absolute
            inset-0
            bg-gradient-to-t
            from-[#050816]
            via-black/40
            to-black/20
          "
        />

        {/* CONTENT */}
        <div
          className="
            absolute
            bottom-0
            z-10
            flex
            w-full
            flex-col
            gap-8
            p-8
            md:flex-row
            md:items-end
          "
        >
          {/* POSTER */}
          <div
            className="
              relative
              h-[420px]
              w-[280px]
              overflow-hidden
              rounded-3xl
              border
              border-white/10
            "
          >
            <Image
              src={poster}
              alt={
                movie.title ||
                "Movie Poster"
              }
              fill
              sizes="280px"
              className="object-cover"
            />
          </div>

          {/* DETAILS */}
          <div className="max-w-3xl">
            <h1
              className="
                text-5xl
                font-black
                md:text-7xl
              "
            >
              {movie.title}
            </h1>

            <p
              className="
                mt-6
                text-lg
                text-gray-300
              "
            >
              {movie.overview}
            </p>

            {/* BUTTONS */}
            <div className="mt-8 flex gap-4">
              {/* PLAY */} 
              <Link href={`/watch/${movie.id}`} className="btn-primary" > Play Now </Link>

             {/* TRAILER */} 
             {/* <button className="btn-secondary"> Watch Trailer </button> */}
             <TrailerButton trailerKey={ movie.trailerKey } title={movie.title} />

            </div>
          </div>
        </div>        
      </section>

      {/* CAST SECTION */}
        <section className="px-6  md:px-10 py-12 rounded-[32px]  bg-white/[0.02] border  border-white/5 backdrop-blur-xl">
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
                    group rounded-3xl overflow-hidden border border-white/10 bg-[#0B1120] transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/30 hover:shadow-glow
                  "
                >
                  <div className="relative aspect-[2/3] ">
                  <Link href={`/actor/${actor.id}`}>
                    <Image
                      src={
                        actor.profile_path
                          ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                          : "/placeholder-user.jpg"
                      }
                      alt={actor.name || "Actor"}
                      fill
                      sizes=" (max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw "
                      className="object-cover"
                    />
                    </Link>
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

    </AppShell>
  );
}
