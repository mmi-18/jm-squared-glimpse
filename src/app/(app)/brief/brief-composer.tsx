"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/upload";
import {
  clearBrief,
  getTopMatchesForViewer,
  saveBrief,
} from "@/app/(app)/brief/actions";
import { BriefMatchesPanel } from "@/app/(app)/brief/brief-matches-panel";
import type {
  DeliverableMedium,
  DeliverablePlatform,
  DurationBucket,
} from "@prisma/client";

type Initial = {
  title: string;
  description: string;
  referenceUrls: string[];
  deliverableMedium: DeliverableMedium | null;
  deliverablePlatforms: DeliverablePlatform[];
  deliverableCountMin: number | null;
  deliverableCountMax: number | null;
  deliverableDuration: DurationBucket | null;
};

type MatchResult = Awaited<ReturnType<typeof getTopMatchesForViewer>>;

const MEDIUM_OPTIONS: { value: DeliverableMedium; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "photo", label: "Photo" },
  { value: "to_be_determined", label: "Still figuring it out" },
];

const PLATFORM_OPTIONS: { value: DeliverablePlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
  { value: "event", label: "Event" },
  { value: "cinema", label: "Cinema" },
  { value: "internal", label: "Internal" },
  { value: "to_be_determined", label: "Still deciding" },
];

const DURATION_OPTIONS: {
  value: DurationBucket;
  label: string;
}[] = [
  { value: "under_15s", label: "Under 15 seconds" },
  { value: "from_15_to_30s", label: "15 – 30 seconds" },
  { value: "from_30_to_60s", label: "30 – 60 seconds" },
  { value: "from_1_to_3_min", label: "1 – 3 minutes" },
  { value: "over_3_min", label: "Over 3 minutes" },
  { value: "not_applicable", label: "Not applicable / varies" },
];

export function BriefComposer({ initial }: { initial: Initial | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [refs, setRefs] = useState<string[]>(initial?.referenceUrls ?? []);
  const [medium, setMedium] = useState<DeliverableMedium | "">(
    initial?.deliverableMedium ?? "",
  );
  const [platforms, setPlatforms] = useState<DeliverablePlatform[]>(
    initial?.deliverablePlatforms ?? [],
  );
  const [countMin, setCountMin] = useState<string>(
    initial?.deliverableCountMin?.toString() ?? "1",
  );
  const [countMax, setCountMax] = useState<string>(
    initial?.deliverableCountMax?.toString() ?? "1",
  );
  const [duration, setDuration] = useState<DurationBucket | "">(
    initial?.deliverableDuration ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Post-submit results state. When `matches` is non-null, the form
  // collapses and the BriefMatchesPanel takes over the page real estate.
  const [matches, setMatches] = useState<MatchResult | null>(null);

  function togglePlatform(v: DeliverablePlatform) {
    setPlatforms((p) =>
      p.includes(v) ? p.filter((x) => x !== v) : [...p, v],
    );
  }

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const results = await Promise.all(files.map((f) => uploadFile(f)));
      setRefs((r) => [...r, ...results.map((res) => res.url)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeRef(i: number) {
    setRefs((r) => r.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const cmin = Number.parseInt(countMin, 10);
      const cmax = Number.parseInt(countMax, 10);
      const res = await saveBrief({
        title,
        description,
        referenceUrls: refs,
        deliverableMedium: (medium || null) as DeliverableMedium | null,
        deliverablePlatforms: platforms,
        deliverableCountMin: Number.isFinite(cmin) ? cmin : null,
        deliverableCountMax: Number.isFinite(cmax) ? cmax : null,
        deliverableDuration: (duration || null) as DurationBucket | null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Save succeeded — fire the match query immediately. The
      // BriefMatchesPanel handles the theatrical loader UX; we just
      // hand it the actual data when it's ready.
      const top = await getTopMatchesForViewer(3);
      setMatches(top);
    });
  }

  function onClear() {
    startTransition(async () => {
      await clearBrief();
      setTitle("");
      setDescription("");
      setRefs([]);
      setMedium("");
      setPlatforms([]);
      setCountMin("1");
      setCountMax("1");
      setDuration("");
      setMatches(null);
      router.refresh();
    });
  }

  function startNewBrief() {
    // From the results view, "Edit brief" collapses the panel and
    // restores the form. Field values stay so the startup can iterate.
    setMatches(null);
  }

  const hasActive = initial !== null;
  const showDuration = medium === "video";
  const canSubmit =
    !pending &&
    !uploading &&
    title.trim().length > 0 &&
    description.trim().length > 0;

  // Results-state branch: form fully replaced by the matches panel.
  if (matches !== null) {
    return (
      <BriefMatchesPanel
        matches={matches}
        briefTitle={title}
        onEditBrief={startNewBrief}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. R 1300 GS Alpine launch shoot"
        />
      </div>

      {/* Structured deliverable spec */}
      <fieldset className="border-border bg-card space-y-5 rounded-2xl border p-5">
        <legend className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-[0.12em]">
          What are you making?
        </legend>

        <div className="space-y-2">
          <Label htmlFor="medium">Medium</Label>
          <select
            id="medium"
            value={medium}
            onChange={(e) =>
              setMedium(e.target.value as DeliverableMedium | "")
            }
            className="border-border bg-background min-h-[40px] w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Pick one…</option>
            {MEDIUM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Platforms it&apos;ll run on</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((opt) => {
              const picked = platforms.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePlatform(opt.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    picked
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Pick all that apply. One 9:16 cut often lives on Instagram +
            TikTok + Reels — flag both so the creator knows the scope.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="countMin">Min quantity</Label>
            <Input
              id="countMin"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={countMin}
              onChange={(e) => setCountMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="countMax">Max quantity</Label>
            <Input
              id="countMax"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={countMax}
              onChange={(e) => setCountMax(e.target.value)}
            />
          </div>
        </div>

        {showDuration && (
          <div className="space-y-2">
            <Label htmlFor="duration">Duration per clip</Label>
            <select
              id="duration"
              value={duration}
              onChange={(e) =>
                setDuration(e.target.value as DurationBucket | "")
              }
              className="border-border bg-background min-h-[40px] w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Pick one…</option>
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="description">Context &amp; description</Label>
        <Textarea
          id="description"
          required
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us the why. What's the project about, what feeling, what creator background fits, any constraints worth knowing?"
        />
        <p className="text-muted-foreground text-xs">
          We use this — alongside your company profile — to find creators
          whose style and industry experience fit.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Reference moodboard</Label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {refs.map((src, i) => (
            <div
              key={i}
              className="border-border bg-muted relative aspect-square overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Reference ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeRef(i)}
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove reference"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label
            className={cn(
              "border-border bg-muted/30 hover:bg-muted flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed transition-colors",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={onFilePick}
            />
            <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              <span>{uploading ? "Uploading…" : "Add image"}</span>
            </div>
          </label>
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Upload className="h-3 w-3" /> Drop multiple images to build a
          moodboard.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/30 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          {hasActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={pending}
              className="text-muted-foreground"
            >
              Clear active brief
            </Button>
          )}
        </div>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />{" "}
              {hasActive ? "Update & find matches" : "Save & find matches"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
