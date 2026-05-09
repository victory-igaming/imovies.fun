import Image from "next/image";

import AppShell from "@/components/layout/AppShell";

import Link from "next/link";

const API_KEY =
  process.env.TMDB_API_KEY;

interface Props {
  params: Promise<{
    id: string;
  }>;
}

async function getActor(
  actorId: string
) {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/${actorId}?api_key=${API_KEY}&append_to_response=movie_credits`,
    {
      next: {
        revalidate: 3600,
      },
    }
  );

  return res.json();
}

export default async function ActorPage({
  params,
}: Props) {
  const { id } = await params;

  const actor = await getActor(id);

  /* NOT FOUND */
  if (
    !actor ||
    actor.success === false
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
          <h2 className="text-4xl font-black">
            Actor Not Found
          </h2>
        </div>
      </AppShell>
    );
  }

  const profileImage =
    actor.profile_path
      ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
      : "/placeholder-user.jpg";

  return (
    <AppShell>
      {/* HERO */}
      <section
        className="
          relative
          overflow-hidden
          rounded-[32px]
          border
          border-white/10
          bg-[#0B1120]
          p-8
        "
      >
        <div
          className="
            flex
            flex-col
            gap-10
            md:flex-row
          "
        >
          {/* IMAGE */}
          <div
            className="
              relative
              h-[500px]
              w-full
              overflow-hidden
              rounded-3xl
              md:w-[340px]
            "
          >
            <Image
              src={profileImage}
              alt={
                actor.name ||
                "Actor"
              }
              fill
              priority
              sizes="340px"
              className="object-cover"
            />
          </div>

          {/* INFO */}
          <div className="flex-1">
            <h1
              className="
                text-5xl
                font-black
                md:text-7xl
              "
            >
              {actor.name}
            </h1>

            {/* META */}
            <div
              className="
                mt-6
                flex
                flex-wrap
                gap-4
                text-gray-300
              "
            >
              {actor.birthday && (
                <span>
                  Born: {actor.birthday}
                </span>
              )}

              {actor.place_of_birth && (
                <span>
                  • {actor.place_of_birth}
                </span>
              )}
            </div>

            {/* BIO */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold">
                Biography
              </h2>

              <p
                className="
                  mt-4
                  max-w-4xl
                  leading-relaxed
                  text-gray-300
                "
              >
                {actor.biography ||
                  "No biography available."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KNOWN FOR */}
      <section className="mt-14">
        <div
          className="
            mb-8
            flex
            items-center
            justify-between
          "
        >
          <h2 className="text-3xl font-black">
            Known For
          </h2>
        </div>

        <div
          className="
            grid
            grid-cols-2
            gap-5
            md:grid-cols-4
            lg:grid-cols-6
          "
        >
          {actor.movie_credits?.cast
            ?.slice(0, 12)
            .map((movie: any) => (
              <Link
                key={movie.id}
                href={`/movie/${movie.id}`}
                className="
                  group
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
                {/* POSTER */}
                <div className="relative aspect-[2/3]">
                  <Image
                    src={
                      movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : "/placeholders/poster.jpg"
                    }
                    alt={
                      movie.title ||
                      "Movie Poster"
                    }
                    fill
                    sizes="
                      (max-width:640px) 50vw,
                      (max-width:1024px) 25vw,
                      16vw
                    "
                    className="object-cover"
                  />
                </div>

                {/* INFO */}
                <div className="p-4">
                  <h3
                    className="
                      line-clamp-1
                      font-semibold
                    "
                  >
                    {movie.title}
                  </h3>

                  <p
                    className="
                      mt-2
                      text-sm
                      text-gray-400
                    "
                  >
                    {movie.release_date?.split(
                      "-"
                    )[0] || "N/A"}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      </section>
    </AppShell>
  );
}

