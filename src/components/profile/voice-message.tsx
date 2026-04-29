"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fake voice-message player. No audio actually plays — this is a UI stub
 * for the MVP to show the feature exists in the About Me section.
 *
 * The waveform is deterministic per name so it stays stable between renders.
 */
export function VoiceMessage({
  seed,
  durationSec = 42,
}: {
  seed: string;
  durationSec?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const intervalRef = useRef<number | null>(null);

  // Bar count is fixed but each bar is flex-1, so the waveform stretches or
  // compresses to fit any cell width (1×1 → 2×2). `min-w-[1px]` keeps bars
  // visible in the narrowest case.
  const bars = makeBars(seed, 40);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 0.02;
        if (next >= 1) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, (durationSec * 1000) / 50);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [playing, durationSec]);

  const currentSec = Math.floor(progress * durationSec);
  const remainingSec = durationSec - currentSec;

  return (
    <div className="flex h-full w-full flex-col justify-center overflow-hidden">
      <div className="mb-2 flex items-center gap-2">
        <Mic className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="text-muted-foreground truncate text-[10px] uppercase tracking-wider">
          Voice intro
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="bg-foreground text-background hover:bg-foreground/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 items-center gap-[1.5px]">
            {bars.map((h, i) => {
              const played = i / bars.length < progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-w-[1px] flex-1 rounded-full transition-colors",
                    played ? "bg-foreground" : "bg-muted-foreground/30",
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[10px] tabular-nums">
            <span>
              {String(Math.floor(currentSec / 60)).padStart(1, "0")}:
              {String(currentSec % 60).padStart(2, "0")}
            </span>
            <span>
              −{String(Math.floor(remainingSec / 60)).padStart(1, "0")}:
              {String(remainingSec % 60).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeBars(seed: string, n: number): number[] {
  // Deterministic pseudo-random from the seed string
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    const v = ((h >>> 0) % 1000) / 1000; // 0..1
    // Shape like a voice envelope: smaller at edges, bigger in middle
    const env = Math.sin((i / (n - 1)) * Math.PI);
    out.push(0.2 + v * 0.55 * env + 0.1 * env);
  }
  return out;
}
