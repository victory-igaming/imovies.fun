"use client";

import {
  Moon,
  Sun,
} from "lucide-react";

import {
  useThemeStore,
} from "@/store/theme.store";

export default function ThemeToggle() {
  const {
    darkMode,
    toggleTheme,
  } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="
        flex
        h-12
        w-12
        items-center
        justify-center
        rounded-2xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        transition-all
        hover:scale-105
        hover:bg-white/10
      "
    >
      {darkMode ? (
        <Moon
          size={22}
          className="text-cyan-400"
        />
      ) : (
        <Sun
          size={22}
          className="text-yellow-400"
        />
      )}
    </button>
  );
}