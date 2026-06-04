import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import MovieCard from "@/components/movie/MovieCard";

import SidebarGoogleAd from "@/components/ads/SidebarGoogleAd";
import SponsorCard from "@/components/ads/SidebarSponsorBox";

import ClientMoviePlayer from "@/components/player/ClientMoviePlayer";

import { getOrSyncMovie } from "@/services/cmsdb";
import { getMovieBlogs } from "@/services/cmsdb";

import {
  getMovieDetails,
  getTrendingMovies,
} from "@/services/tmdb";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;

  const clientid =   process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || "ca-pub-7209701250707799"; 

  const sidebarSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT || "7134773617";

  const relatedSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_RELATED_SLOT || "6854207635";


  const [movie, movieSync, recommendedMovies, movieBlogs] =
    await Promise.all([
      getMovieDetails(id),
      getOrSyncMovie(id),
      getTrendingMovies(),
      getMovieBlogs(id),
    ]);

  const finalMovie = {
    ...movie,
    ...movieSync,
    id: movie.id || movieSync.tmdb_id,
    title: movie.title || movieSync.title,
    overview: movie.overview || movieSync.overview,
    release_date:
      movie.release_date || movieSync.release_date,
    runtime: movie.runtime || movieSync.runtime || 120,
    poster_path:
      movie.poster_path || movieSync.poster_path,
    backdrop_path:
      movie.backdrop_path || movieSync.backdrop_path,
  };


  const blogs = Array.isArray(movieBlogs) ? movieBlogs : [];

  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      <Sidebar />

      <section className="flex-1 md:ml-64">
        <Header />

        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
            <div>
              <div className="mb-6">
                <h1 className="text-3xl md:text-5xl font-black">
                  {finalMovie.title}
                </h1>

                <p className="text-gray-400 mt-2">
                  {finalMovie.release_date?.split("-")[0]}
                </p>
              </div>

              <ClientMoviePlayer movie={finalMovie} />

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-2xl font-bold mb-4">
                  Overview
                </h2>

                <p className="text-gray-300 leading-relaxed">
                  {finalMovie.overview}
                </p>
              </div>


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


            </div>

            <aside className="space-y-6">
             


           

                {/* Normal sidebar display ad */}
      <SidebarGoogleAd
        clientid={clientid}
        slotid={sidebarSlot}
        format="auto"
        minHeight={280}
      />

      {/* Your CMS sponsored ads */}
      <SponsorCard />

      {/* Auto relaxed / related ad */}
      <SidebarGoogleAd
        clientid={clientid}
        slotid={relatedSlot}
        format="autorelaxed"
        responsive={false}
        minHeight={360}
      />

              

              {/* <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h3 className="text-2xl font-black mb-5">
                  Recommended
                </h3>

                <div className="space-y-5">
                  {recommendedMovies
                    .slice(0, 4)
                    .map((movie: any) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                      />
                    ))}
                </div>
              </div> */}

            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}