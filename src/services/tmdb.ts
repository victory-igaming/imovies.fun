
const API_KEY =
  process.env.TMDB_API_KEY;

const BASE_URL =
  "https://api.themoviedb.org/3";

const fetchOptions: RequestInit = {
  next: {
    revalidate: 3600,
  },
};

/* TRENDING MOVIES */
export async function getTrendingMovies() {
  try {
    const response = await fetch(
      `${BASE_URL}/trending/movie/week?api_key=${API_KEY}`,
      fetchOptions
    );

    const data = await response.json();

    return data.results || [];
  } catch (error) {
    console.error(
      "Trending Movies Error:",
      error
    );

    return [];
  }
}

/* POPULAR MOVIES */
export async function getPopularMovies() {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/popular?api_key=${API_KEY}`,
      fetchOptions
    );

    const data = await response.json();

    return data.results || [];
  } catch (error) {
    console.error(error);

    return [];
  }
}

/* MOVIE DETAILS */
export async function getMovieDetails(
  movieId: string
  
) {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=videos,credits,recommendations`,
      fetchOptions
    );

    const data = await response.json();

    const trailer = data.videos?.results?.find(
      (video: any) =>
        video.site === "YouTube" &&
        video.type === "Trailer"
    );

    return {
      ...data,
      trailer,

      /* DEMO STREAM */
      // videoUrl:
      //   "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      
      /* STREAM URL */
      videoUrl: Number(movieId) > 0 ? `https://vidlink.pro/movie/${movieId}` : null,

      /* TRAILER */
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      trailerKey:  trailer?.key || null,

    };
  } catch (error) {
    console.error(
      "Movie Details Error:",
      error
    );

    throw error;
  }
}

/* SEARCH */
export async function searchMovies(
  query: string
) {
  try {
    if (!query) return [];

    const response = await fetch(
      `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
        query
      )}`,
      fetchOptions
    );

    const data = await response.json();

    return data.results || [];
  } catch (error) {
    console.error(
      "Search Error:",
      error
    );

    return [];
  }
}

/* RECOMMENDATIONS */
export async function getRecommendations(
  movieId: string
) {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/${movieId}/recommendations?api_key=${API_KEY}`,
      fetchOptions
    );

    const data = await response.json();

    return data.results || [];
  } catch (error) {
    console.error(error);

    return [];
  }
}
