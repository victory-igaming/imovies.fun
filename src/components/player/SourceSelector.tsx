"use client";

import { Check, X, MonitorPlay } from "lucide-react";

interface PlayerSource {
  title: string;
  source: string;
}

interface Props {
  open: boolean;
  players: PlayerSource[];
  selectedSource: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function SourceSelector({
  open,
  players,
  selectedSource,
  onSelect,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-[#0B1120] p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">Streaming Sources</h2>
            <p className="mt-1 text-sm text-gray-400">Choose your preferred player</p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sources */}
        <div className="space-y-3">
          {players.map((player, index) => {
            const active = selectedSource === index;
            return (
              <button
                key={player.title}
                onClick={() => onSelect(index)}
                className={`
                  flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all
                  ${active
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      active ? "bg-cyan-400 text-black" : "bg-white/5"
                    }`}
                  >
                    <MonitorPlay size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold">{player.title}</h3>
                    <p className="text-sm text-gray-400">HD Streaming</p>
                  </div>
                </div>

                {active && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-black">
                    <Check size={18} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-gray-400">
            If one source buffers or fails, switch to another streaming provider.
          </p>
        </div>
      </div>
    </div>
  );
}
