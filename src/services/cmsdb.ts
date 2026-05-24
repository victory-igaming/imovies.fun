// ./service/cmsdb.ts

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL;
const CMS_TOKEN = process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;


export async function getAdvertisements() {
  const baseUrl = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, ""); 
  const token = process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;
  const endpoint = `${baseUrl}/api/advertisement`;

  console.log("DEBUG: Fetching ads from ->", endpoint);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Ensure ${endpoint} exists in Laravel routes.`);
    }

    return await response.json();
  } catch (error) {
    console.error("CMS API Error:", error);
    throw error;
  }
}


export async function getAdvertisementsNew() {
  const endpoint = "/api/advertisement";

  console.log("DEBUG: Fetching ads from ->", endpoint);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to load advertisements.`);
    }

    return await response.json();
  } catch (error) {
    console.error("Advertisement API Error:", error);
    return [];
  }

  
}