"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import {
  Home,
  Film,
  Search,
  Heart,
  Library,
} from "lucide-react";

const navItems = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Movies",
    href: "/movies",
    icon: Film,
  },
  {
    label: "Search",
    href: "/search",
    icon: Search,
  },
  {
    label: "Favorites",
    href: "/favorites",
    icon: Heart,
  },
  {
    label: "Library",
    href: "/library",
    icon: Library,
  },
];

export default function Mobilenav() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed
        bottom-0
        left-0
        right-0
        z-50
        md:hidden
        border-t
        border-white/10
        bg-[#050816]/90
        backdrop-blur-2xl
        px-2
        pb-[calc(env(safe-area-inset-bottom)+10px)]
        pt-3
      "
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="
                relative
                flex
                flex-col
                items-center
                justify-center
                gap-1
                px-3
                py-2
                rounded-2xl
                transition-all
                duration-300
              "
            >
              {/* ACTIVE BACKGROUND */}
              {active && (
                <div
                  className="
                    absolute
                    inset-0
                    rounded-2xl
                    bg-gradient-to-r
                    from-cyan-400/20
                    to-blue-500/20
                    border
                    border-cyan-400/20
                    shadow-[0_0_25px_rgba(0,210,255,0.15)]
                  "
                />
              )}

              {/* ICON */}
              <div className="relative z-10">
                <Icon
                  size={22}
                  className={
                    active
                      ? "text-cyan-400"
                      : "text-gray-400"
                  }
                />
              </div>

              {/* LABEL */}
              <span
                className={`
                  relative
                  z-10
                  text-[11px]
                  font-medium
                  transition-all
                  ${
                    active
                      ? "text-cyan-300"
                      : "text-gray-500"
                  }
                `}
              >
                {item.label}
              </span>

              {/* ACTIVE DOT */}
              {active && (
                <div
                  className="
                    absolute
                    -top-1
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-cyan-400
                    shadow-[0_0_12px_rgba(0,210,255,0.8)]
                  "
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}