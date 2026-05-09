import Sidebar from "@/components/layout/Sidebar";

import Header from "@/components/layout/Header";

import MovieCard from "@/components/movie/MovieCard";

import {
  searchMovies,
} from "@/services/tmdb";

import {
  Search,
  Sparkles,
} from "lucide-react";

interface Props {
  params: Promise<{
    keyword: string;
  }>;
}

export default async function SearchPage({
  params,
}: Props) {
  const { keyword } =
    await params;

  const decodedKeyword =
    decodeURIComponent(
      keyword
    );

  const movies =
    await searchMovies(
      decodedKeyword
    );

  return (
    <main
      className="
        flex
        min-h-screen
        bg-[#050816]
        text-white
      "
    >
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section
        className="
          flex-1
          pb-24
          md:ml-64
        "
      >
        <Header />

        <div className="p-4 md:p-8">
          {/* HERO */}
          <div
            className="
              relative
              overflow-hidden
              rounded-[40px]
              border
              border-white/10
              bg-gradient-to-br
              from-cyan-500/10
              via-blue-500/5
              to-purple-500/10
              p-8
              md:p-12
            "
          >
            {/* GLOW */}
            <div
              className="
                absolute
                right-0
                top-0
                h-64
                w-64
                rounded-full
                bg-cyan-400/20
                blur-3xl
              "
            />

            <div className="relative z-10">
              {/* BADGE */}
              <div
                className="
                  mb-5
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-cyan-400/20
                  bg-cyan-400/10
                  px-4
                  py-2
                  text-sm
                  text-cyan-300
                "
              >
                <Sparkles size={16} />

                Smart Search
              </div>

              {/* TITLE */}
              <h1
                className="
                  max-w-4xl
                  text-5xl
                  font-black
                  leading-tight
                  md:text-7xl
                "
              >
                Search Results
              </h1>

              {/* SUBTITLE */}
              <p
                className="
                  mt-6
                  max-w-2xl
                  text-lg
                  text-gray-400
                "
              >
                Showing cinematic
                results for
                {" "}
                <span className="text-cyan-400">
                  "{decodedKeyword}"
                </span>
              </p>

             
            </div>
          </div>

          {/* RESULTS HEADER */}
          <div
            className="
              mt-14
              mb-8
              flex
              items-center
              justify-between
            "
          >
            <div>
              <h2
                className="
                  text-3xl
                  font-black
                "
              >
                Results
              </h2>

              <p className="mt-2 text-gray-400">
                Found
                {" "}
                <span className="text-cyan-400">
                  {movies.length}
                </span>
                {" "}
                movies
              </p>
            </div>
          </div>

          {/* EMPTY */}
          {!movies?.length ? (
            <div
              className="
                flex
                flex-col
                items-center
                justify-center
                py-24
                text-center
              "
            >
              <div
                className="
                  flex
                  h-24
                  w-24
                  items-center
                  justify-center
                  rounded-full
                  bg-white/5
                "
              >
                <Search
                  size={42}
                  className="text-gray-500"
                />
              </div>

              <h3
                className="
                  mt-8
                  text-4xl
                  font-black
                "
              >
                No Results Found
              </h3>

              <p
                className="
                  mt-3
                  max-w-md
                  text-gray-400
                "
              >
                Try another movie,
                TV show, or actor
                keyword.
              </p>
            </div>
          ) : (
            /* MOVIE GRID */
            <div
              className="
                grid
                grid-cols-2
                gap-5
                sm:grid-cols-3
                md:grid-cols-4
                xl:grid-cols-6
              "
            >
              {movies.map(
                (movie:any) => (
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

