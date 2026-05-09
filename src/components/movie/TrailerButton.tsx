"use client";

import { useState } from "react";

import {
  PlayCircle,
} from "lucide-react";

import TrailerModal from "./TrailerModal";

interface Props {
  trailerKey?: string;

  title?: string;
}

export default function TrailerButton({
  trailerKey,
  title,
}: Props) {
  const [open, setOpen] =
    useState(false);

  if (!trailerKey) {
    return (
      <button
        disabled
        className="
          btn-secondary
          cursor-not-allowed
          opacity-50
        "
      >
        Trailer Unavailable
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() =>
          setOpen(true)
        }
        className="
          flex
          items-center
          gap-3
          rounded-2xl
          bg-gradient-to-r
          from-pink-500
          to-red-500
          px-8
          py-4
          font-bold
          text-white
          shadow-2xl
          shadow-pink-500/30
          transition-all
          hover:scale-105
        "
      >
        <PlayCircle size={24} />

        Trailer
      </button>

      <TrailerModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
        trailerKey={trailerKey}
        title={title}
      />
    </>
  );
}

