"use client";

import Link from "next/link";

import Image from "next/image";

export default function Logo() {
  return (
    <Link
      href="/"
      className="
        flex
        items-center
        gap-3
      "
    >
      <div
        className="
          relative
          h-12
          w-12
          overflow-hidden
          rounded-2xl
          bg-gradient-to-br
          from-cyan-400
          to-blue-600
          shadow-lg
          shadow-cyan-500/30
        "
      >
        <Image
          src="/logos/logo.png"
          alt="iMovies"
          fill
          priority
          sizes="48px"
          className="object-cover"
        />
      </div>

      <div className="hidden md:block">
        <h1
          className="
            text-2xl
            font-black
            tracking-tight
          "
        >
          iMovies
        </h1>

        <p
          className="
            -mt-1
            text-xs
            text-gray-400
          "
        >
          Premium Streaming
        </p>
      </div>
    </Link>
  );
}