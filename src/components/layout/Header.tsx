"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { searchMovies } from "@/services/tmdb";



import {
  Bell,
  Search,
  Command,
} from "lucide-react";

export default function Header() {
  const [openSearch, setOpenSearch] = useState(false);

  const router = useRouter();

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
 



  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setOpenSearch((prev) => !prev);
      }
    };

    window.addEventListener("keydown", down);

    return () => {
      window.removeEventListener("keydown", down);
    };
  }, []);


useEffect(() => {
  const fetchResults =
    async () => {
      if (!query.trim()) {
        setResults([]);

        return;
      }

      try {
        setLoading(true);

        const data =
          await searchMovies(
            query
          );

        setResults(
          data.slice(0, 6)
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

  const debounce =
    setTimeout(() => {
      fetchResults();
    }, 400);

  return () =>
    clearTimeout(debounce);
}, [query]);
 


  return (
    <header
      className="
        sticky
        top-0
        z-40
        w-full
        border-b
        border-white/10
        bg-[#050816]/80
        backdrop-blur-2xl
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          gap-4
          px-4
          md:px-8
          py-4
        "
      >
        {/* LEFT */}
        <div className="flex items-center gap-4 w-full">
          {/* SEARCH */}
          <div
            className="
              relative
              hidden
              md:flex
              items-center
              w-full
              max-w-2xl
            "
          >
            <Search
              size={18}
              className="
                absolute
                left-4
                text-gray-400
              "
            />
 
<input
  type="text"
  placeholder="Search movies, TV shows..."
  value={query}
  onChange={(e) =>
    setQuery(e.target.value)
  }
  onKeyDown={(e) => {
    if (
      e.key === "Enter"
    ) {
      router.push(
        `/search/${encodeURIComponent(
          query
        )}`
      );

      setResults([]);
    }
  }}
  className="
    w-full
    rounded-3xl
    border
    border-white/10
    bg-white/5
    py-5
    pl-14
    pr-6
    text-lg
    text-white
    outline-none
    backdrop-blur-xl
    transition-all
    duration-300
    placeholder:text-gray-500
    focus:border-cyan-400/50
    focus:bg-white/10
    focus:shadow-[0_0_30px_rgba(0,210,255,0.15)]
  "
/>
 

            {/* CTRL + K */}
            <div
              className="
                absolute
                right-4
                flex
                items-center
                gap-1
                rounded-lg
                border
                border-white/10
                bg-black/30
                px-2
                py-1
                text-xs
                text-gray-400
              "
            >
              <Command size={12} />

              <span>K</span>
            </div>
          </div>

          {/* MOBILE SEARCH BUTTON */}
          <button
            className="
              flex
              md:hidden
              items-center
              justify-center
              w-12
              h-12
              rounded-2xl
              bg-white/5
              border
              border-white/10
              text-white
            "
          title="Search"
          suppressHydrationWarning={true}
          >
            <Search size={20} />
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* NOTIFICATIONS */}
          <button
            className="
              relative
              flex
              items-center
              justify-center
              w-12
              h-12
              rounded-2xl
              border
              border-white/10
              bg-white/5
              backdrop-blur-xl
              transition-all
              duration-300
              hover:bg-white/10
              hover:shadow-[0_0_25px_rgba(0,210,255,0.15)]
            "
          title="Notifications"
          suppressHydrationWarning={true}
          >
            <Bell size={20} />

            {/* NOTIFICATION DOT */}
            <span
              className="
                absolute
                top-3
                right-3
                w-2
                h-2
                rounded-full
                bg-cyan-400
                animate-pulse
              "
            />
          </button>

          {/* PROFILE */}
          <button
            className="
              flex
              items-center
              gap-3
              rounded-2xl
              border
              border-white/10
              bg-white/5
              px-3
              py-2
              backdrop-blur-xl
              transition-all
              duration-300
              hover:bg-white/10
            "
          title="Profile"
          suppressHydrationWarning={true}
          >
           {/* AVATAR */}
              <div
              className="
                flex
                items-center
                justify-center
                w-10
                h-10
                rounded-xl
                bg-gradient-to-r
                from-cyan-400
                to-blue-500
                font-bold
                text-black
              "
            >
              I
            </div> 
  
           {/* USER INFO */}
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-white">
                iMovies User
              </p>

              {/* <p className="text-xs text-gray-400">
                Premium Member
              </p> */}
            </div>
         
          </button>
        </div>
      </div>

      {/* SEARCH MODAL MOBILE */}
      {openSearch && (
        <div
          className="
            md:hidden
            border-t
            border-white/10
            p-4
            bg-[#050816]/95
            backdrop-blur-2xl
          "
        >
          <div className="relative">
            <Search
              size={18}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />

            <input
              suppressHydrationWarning
              autoFocus
              type="text"
              placeholder="Search movies..."
              className="
                w-full
                rounded-2xl
                border
                border-white/10
                bg-white/5
                py-4
                pl-12
                pr-4
                text-sm
                text-white
                outline-none
                placeholder:text-gray-500
              "
            />
          </div>
        </div>
      )}
    </header>
  );
}