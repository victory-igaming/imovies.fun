"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore,} from "@/store/ui.store";


import {
  Home,
  Search,
  Library,
  Film,
  Heart,
  Flame,
} from "lucide-react";

const navItems = [
  {
    name: "Home",
    href: "/",
    icon: Home,
  },
  {
    name: "Trending",
    href: "/trending",
    icon: Flame,
  },
  {
    name: "Movies",
    href: "/movies",
    icon: Film,
  },
  {
    name: "Search",
    href: "/search",
    icon: Search,
  },
  {
    name: "Favorites",
    href: "/favorites",
    icon: Heart,
  },
  {
    name: "Library",
    href: "/library",
    icon: Library,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const { sidebarOpen,toggleSidebar,} = useUIStore();

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-20 md:w-64 bg-[#081018]/95 backdrop-blur-xl border-r border-white/10 p-4 flex flex-col">
      {/* LOGO */}
      <Link
        href="/"
        className="flex items-center gap-3 mb-10"
      >
        <div className="relative w-12 h-12">
          <Image
            src={"/logos/logo.png"}
            alt="iMovies"
            fill
            sizes="144px"
            className="object-contain"
          />
        </div>

        <div className="hidden md:block">
          <h1 className="text-2xl font-black text-white">
            iMovies
          </h1>

          <p className="text-xs text-gray-400">
            Digital Streaming
          </p>
        </div>
      </Link>

      {/* NAVIGATION */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center gap-4 rounded-2xl px-4 py-4 transition-all duration-300
              
              ${
                active
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-[0_0_25px_rgba(0,210,255,0.35)]"
                  : "hover:bg-white/10 text-gray-300 hover:text-white"
              }
              `}
            >
              <Icon size={22} />

              <span className="hidden md:block font-medium">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="mt-auto hidden md:block">
        <div className="rounded-3xl p-5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/20">
          <h3 className="font-bold mb-2">
            Premium Streaming
          </h3>

          <p className="text-sm text-gray-400 mb-4">
            Watch movies in 4K Ultra HD.
          </p>

          <button className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 py-3 font-bold text-black hover:scale-105 transition">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}