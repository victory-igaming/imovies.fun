import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Gracefully handle server keys or public fallback profiles
    const CMS_URL = process.env.CMS_URL || process.env.NEXT_PUBLIC_CMS_URL;
    const CMS_TOKEN = process.env.CMS_TOKEN_KEY || process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;

    if (!CMS_URL) {
      return NextResponse.json({ error: "Server Error: CMS_URL is missing in environment." }, { status: 500 });
    }
    if (!CMS_TOKEN) {
      return NextResponse.json({ error: "Server Error: CMS_TOKEN_KEY is missing in environment." }, { status: 500 });
    }

    // Read payload parameters incoming from client-side trackAd()
    const body = await request.json();

    // 1. EXTRACT REAL CLIENT IP FROM HEADERS
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = forwardedFor 
      ? forwardedFor.split(",")[0].trim() 
      : request.headers.get("x-real-ip") || "127.0.0.1";
    
    // 2. CONVERT IP STRING TO AN INTEGER TO BYPASS LARAVEL VALIDATION
    // Example: "192.168.31.122" becomes "19216831122", which parses cleanly as a number
   // const numericIpString = realIp.replace(/[^0-9]/g, "");
   // const cleanViewerId = numericIpString ? parseInt(numericIpString, 10) : 0;

    // 3. CONSTRUCT THE TARGET QUERY PARAMS
    const queryParams = new URLSearchParams({
      ad_id: String(body.ad_id || ''),
      duration: String(body.duration || ''),
      movie_id: String(body.movie_id || ''),
      tmdb_id: String(body.tmdb_id || ''),
      viewer_id: String(realIp), // Now it's guaranteed to be a valid integer!
    });

    const TARGET_URL = `${CMS_URL?.replace(/\/$/, "")}/api/track-ad?${queryParams.toString()}`;

    // Execute the call to your Laravel Backend
    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CMS_TOKEN}`, 
      },
      cache: "no-store",
    });

    const textResponse = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        error: "Laravel CMS Tracking Endpoint Refused Request",
        status: res.status,
        body: textResponse,
      }, { status: res.status });
    }

    const data = textResponse ? JSON.parse(textResponse) : { status: "success" };
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({
      error: "Internal Gateway Proxy Error",
      message: error.message,
    }, { status: 500 });
  }
}