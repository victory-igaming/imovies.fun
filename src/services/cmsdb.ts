const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, "");

const CMS_TOKEN = process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;

/* =========================================================
   COMMON FETCH HELPER
========================================================= */
async function cmsFetch(endpoint: string, options?: RequestInit) {
  if (!CMS_URL) {
    throw new Error("NEXT_PUBLIC_CMS_URL is missing");
  }

  const fullUrl = `${CMS_URL}${endpoint}`;

  console.log("FULL CMS API =", fullUrl);

  const response = await fetch(fullUrl, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(CMS_TOKEN ? { Authorization: `Bearer ${CMS_TOKEN}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("CMS ERROR RESPONSE:", errorText);

    throw new Error(`CMS API Error ${response.status}`);
  }

  return response.json();
}

/* =========================================================
   GET MOVIE VIDEO ADVERTISEMENTS
========================================================= */
export async function getAdvertisements() {
  try {
    return await cmsFetch("/api/advertisement");
  } catch (error) {
    console.error("Advertisement Fetch Error:", error);
    return [];
  }
}

/* =========================================================
   GET SPONSORED SIDEBAR ADVERTISEMENTS
========================================================= */
export type SponsoredAdvertisement = {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image_url?: string | null;
  target_url?: string | null;
  badge_text?: string | null;
  cta_text?: string | null;
  gradient_from?: string | null;
  gradient_to?: string | null;
  display_order?: number;
};

export async function getSponsoredAdvertisements(): Promise<SponsoredAdvertisement[]> {
  try {
    return await cmsFetch("/api/sponsored-advertisements");
  } catch (error) {
    console.error("Sponsored Advertisement Fetch Error:", error);
    return [];
  }
}

/* =========================================================
   GET OR AUTO SYNC MOVIE
========================================================= */
export async function getOrSyncMovie(tmdbId: string | number) {
  try {
    return await cmsFetch(`/api/movies/tmdb/${tmdbId}`);
  } catch (error) {
    console.error("Movie Sync Error:", error);
    return null;
  }
}

/* =========================================================
   GET MOVIE BLOGS
========================================================= */
export async function getMovieBlogs(movieId: string | number) {
  try {
    return await cmsFetch(`/api/movieblogs/${movieId}`);
  } catch (error) {
    console.error("Movie Blog Error:", error);
    return [];
  }
}