"use client";

interface Props {
  watchTime: number;

  runtime: number;

  nextAdTime: number | null;

  adSchedule: number[];

  currentAd: any;

  showAd: boolean;

  playing: boolean;

  loading: boolean;

  showDebug: boolean;
}

export default function DebugPanel({
  watchTime,
  runtime,
  nextAdTime,
  adSchedule,
  currentAd,
  showAd,
  playing,
  loading,
  showDebug,
}: Props) {
  /* DISABLE IN PRODUCTION */
  const SHOW_DEBUG = true;

  if (!SHOW_DEBUG) return null;

  return (
    <div
      className="
        absolute
        bottom-6
        left-6
        z-50
        w-[320px]
        rounded-3xl
        border
        border-cyan-400/20
        bg-black/80
        p-5
        text-sm
        text-white
        shadow-2xl
        backdrop-blur-xl
      "
    >
      {/* HEADER */}
      <div
        className="
          mb-4
          flex
          items-center
          justify-between
        "
      >
        <h3
          className="
            text-lg
            font-black
            text-cyan-400
          "
        >
          Ad Debug Panel
        </h3>

        <div
          className={`
            rounded-full
            px-3
            py-1
            text-xs
            font-bold

            ${showAd 
              ? "bg-red-500/20 text-red-300" 
              : loading 
              ? "bg-yellow-500/20 text-yellow-300" 
              : !playing 
              ? "bg-orange-500/20 text-orange-300" 
              : "bg-green-500/20 text-green-300"
            }
          `}
        >
          {showAd 
          ? "AD PLAYING" 
          : loading ? "PLAYER LOADING" 
          : !playing ? "MOVIE PAUSED" 
          : "MOVIE PLAYING"
          }
        </div>
      </div>

      {/* STATS */}
      <div className="space-y-3">
        {/* WATCH TIME */}
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <span className="text-gray-400">Watch Time</span>

          <span className="font-bold">{Math.floor(watchTime)}s</span>
        </div>

        {/* RUNTIME */}
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <span className="text-gray-400">Runtime</span>

          <span className="font-bold">{runtime}m</span>
        </div>

        {/* NEXT AD */}
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <span className="text-gray-400">Next Ad</span>

          <span className="font-bold text-cyan-400">
            {nextAdTime
              ? `${Math.max(0, Math.floor(nextAdTime - watchTime))}s`
              : "Completed"}
          </span>
        </div>

        {/* CURRENT AD */}
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <span className="text-gray-400">Current Ad</span>

          <span className="font-bold">{currentAd?.title || "None"}</span>
        </div>
      </div>

      {/* SCHEDULE */}
      <div className="mt-5">
        <p
          className="
            mb-3
            text-sm
            font-semibold
            text-gray-300
          "
        >
          Ad Schedule
        </p>

        <div className="flex flex-wrap gap-2">
          {adSchedule.map((time) => (
            <span
              key={time}
              className="
                  rounded-full
                  border
                  border-cyan-400/20
                  bg-cyan-400/10
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  text-cyan-300
                "
            >
              {Math.floor(time / 60)}m
            </span>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div
        className="
          mt-5
          rounded-2xl
          border
          border-white/10
          bg-white/[0.03]
          p-3
          text-xs
          text-gray-400
        "
      >
        Debug mode enabled for ad testing and playback simulation.
      </div>
    </div>
  );
}
