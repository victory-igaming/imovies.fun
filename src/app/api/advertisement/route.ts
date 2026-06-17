// src/app/api/advertisement/route.ts

import { NextResponse } from "next/server";

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, "");

const CMS_TOKEN = process.env.NEXT_PUBLIC_CMS_TOKEN_KEY;

export async function GET() {
  try {
    if (!CMS_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_CMS_URL is missing" },
        { status: 500 },
      );
    }

    const API_URL = `${CMS_URL}/api/advertisement`;

    const res = await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(CMS_TOKEN ? { Authorization: `Bearer ${CMS_TOKEN}` } : {}),
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "CMS API failed",
          status: res.status,
          body: text,
          url: API_URL,
        },
        { status: 500 },
      );
    }

    const ads = JSON.parse(text);

    const fixedAds = ads.map((ad: any) => ({
      ...ad,
      videoUrl: `/api/ad-video?url=${encodeURIComponent(ad.videoUrl)}`,
    }));

    return NextResponse.json(fixedAds);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to load advertisements",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
