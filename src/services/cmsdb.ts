// src/services/cmsdb.ts

const CMS_URL =
  process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, "");

const CMS_TOKEN =
  process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;

/* =========================================================
   COMMON FETCH HELPER
========================================================= */
async function cmsFetch(
  endpoint: string,
  options?: RequestInit
) {
  if (!CMS_URL) {
    throw new Error(
      "NEXT_PUBLIC_CMS_URL is missing"
    );
  }

  const response = await fetch(
    `${CMS_URL}${endpoint}`,
    {
      cache: "no-store",

      ...options,

      headers: {
        Accept: "application/json",

        Authorization: `Bearer ${CMS_TOKEN}`,

        ...(options?.headers || {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `CMS API Error ${response.status}`
    );
  }

  return response.json();
}

/* =========================================================
   GET ADVERTISEMENTS
========================================================= */
export async function getAdvertisements() {
  try {
    return await cmsFetch(
      "/api/advertisement"
    );
  } catch (error) {
    console.error(
      "Advertisement Fetch Error:",
      error
    );

    return [];
  }
}

/* =========================================================
   LEGACY / LOCAL API ADS
========================================================= */
export async function getAdvertisementsNew() {
  try {
    const response = await fetch(
      "/api/advertisement",
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },

        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      "Local Advertisement API Error:",
      error
    );

    return [];
  }
}

/* =========================================================
   GET OR AUTO SYNC MOVIE
========================================================= */
export async function getOrSyncMovie(
  tmdbId: string | number
) {
  try {
   
    return await cmsFetch(
      `/api/movies/tmdb/${tmdbId}`
    );
    
  } catch (error) {
     console.log( `/api/movies/tmdb/${tmdbId}`)
    console.error(
      "Movie Sync Error:",
      error
    );

    return null;
  }
}