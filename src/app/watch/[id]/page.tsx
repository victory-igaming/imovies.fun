import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import MovieCard from "@/components/movie/MovieCard";

import AdsenseBanner from "@/components/ads/AdsenseBanner";


import ClientMoviePlayer from "@/components/player/ClientMoviePlayer";



import {
  getMovieDetails,
  getTrendingMovies,
} from "@/services/tmdb";

interface Props { params: Promise<{ id: string; }>; }

export default async function WatchPage({
  params,
}: Props) {
  const movie = await getMovieDetails((await params).id);
  console.log(movie);
  const recommendedMovies =
    await getTrendingMovies();

  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section className="flex-1 md:ml-64">
        {/* HEADER */}
        <Header />

        {/* PLAYER LAYOUT */}
        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
            {/* LEFT PLAYER */}
            <div>
              {/* MOVIE TITLE */}
              <div className="mb-6">
                <h1 className="text-3xl md:text-5xl font-black">
                  {movie.title}
                </h1>

                <p className="text-gray-400 mt-2">
                  {movie.release_date?.split("-")[0]}
                </p>
              </div>

              {/* VIDEO PLAYER */}            
              <ClientMoviePlayer movie={movie} />
 

              {/* MOVIE DESCRIPTION */}
              <div
                className="
                  mt-8
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/5
                  p-6
                  backdrop-blur-xl
                "
              >
                <h2 className="text-2xl font-bold mb-4">
                  Overview
                </h2>

                <p className="text-gray-300 leading-relaxed">
                  {movie.overview}
                </p>
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <aside className="space-y-6">
              
              {/* ADSENSE */}
              <AdsenseBanner adSlot="1234567890" className="h-[600px]" />

              {/* SPONSORED */}
              <div
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/5
                  p-5
                  backdrop-blur-xl
                "
              >
                <h3 className="text-xl font-bold mb-4">
                  Sponsored
                </h3>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-r from-cyan-400/20 to-blue-500/20 p-4 border border-cyan-400/10">
                    <p className="font-semibold">
                      Premium Streaming
                    </p>

                    <p className="text-sm text-gray-400 mt-2">
                      Enjoy ultra HD streaming experience.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 p-4 border border-pink-400/10">
                    <p className="font-semibold">
                      Watch Anywhere
                    </p>

                    <p className="text-sm text-gray-400 mt-2">
                      Mobile, TV, desktop and tablets.
                    </p>
                  </div>
                </div>
              </div>

              {/* RECOMMENDED */}
              <div
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/5
                  p-5
                  backdrop-blur-xl
                "
              >
                <h3 className="text-2xl font-black mb-5">
                  Recommended
                </h3>

                <div className="space-y-5">
                  {recommendedMovies
                    .slice(0, 4)
                    .map((movie:any) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                      />
                    ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}