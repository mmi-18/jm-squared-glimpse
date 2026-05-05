"use client";

import { useRef, useState, useTransition } from "react";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_EXPERIENCE,
  DELIVERABLE_TYPES,
  STYLE_DIMENSIONS,
} from "@/lib/constants";
import { uploadFile } from "@/lib/upload";
import { createPost } from "@/app/(app)/new-post/actions";

const TOTAL_STEPS = 3;

type StyleKey = (typeof STYLE_DIMENSIONS)[number]["key"];

type State = {
  title: string;
  description: string;
  mediaUrls: string[];
  industry: string;
  contentType: string;
  format: "vertical" | "horizontal" | "square";
  // Each style dimension: null means "use profile default", number means user-set.
  styleProductionValue: number | null;
  stylePacing: number | null;
  styleFocus: number | null;
  styleFraming: number | null;
  styleStaging: number | null;
  styleColor: number | null;
  styleSound: number | null;
};

function toArr(v: number | readonly number[] | undefined): number[] {
  if (Array.isArray(v)) return [...v];
  if (typeof v === "number") return [v];
  return [];
}

/**
 * Three-step structured post-creation wizard. Replaces the earlier cell-
 * spanning grid editor with a more familiar form-driven flow:
 *   1. Pictures + title + description
 *   2. Industry / content type / format
 *   3. Style dimensions (optional — auto-fill from profile)
 *
 * Cell layout + preview tile are auto-generated server-side from the inputs.
 * Future "Edit layout" flow can let power users customize the auto layout.
 */
export function PostEditor({
  defaultIndustry,
  defaultContentType,
  defaultStyle,
}: {
  defaultIndustry: string;
  defaultContentType: string;
  defaultStyle: Partial<Record<StyleKey, number>>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<State>({
    title: "",
    description: "",
    mediaUrls: [],
    industry: defaultIndustry,
    contentType: defaultContentType,
    format: "horizontal",
    styleProductionValue: null,
    stylePacing: null,
    styleFocus: null,
    styleFraming: null,
    styleStaging: null,
    styleColor: null,
    styleSound: null,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function set<K extends keyof State>(k: K, v: State[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  /**
   * Upload selected files to /api/upload (which writes them to
   * /home/mario/glimpse/uploads on the host via the volume mount,
   * served back as `/uploads/<uuid>.<ext>` static URLs). Used to ship
   * actual files instead of stuffing base64 into the DB.
   */
  async function addImagesFromFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const results = await Promise.allSettled(arr.map((f) => uploadFile(f)));
      const newUrls: string[] = [];
      const errors: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") newUrls.push(r.value.url);
        else
          errors.push(r.reason instanceof Error ? r.reason.message : "upload failed");
      }
      if (newUrls.length > 0) {
        setState((s) => ({ ...s, mediaUrls: [...s.mediaUrls, ...newUrls] }));
      }
      if (errors.length > 0) {
        setError(
          errors.length === arr.length
            ? errors[0]
            : `${errors.length} of ${arr.length} uploads failed: ${errors[0]}`,
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setState((s) => ({
      ...s,
      mediaUrls: s.mediaUrls.filter((_, i) => i !== index),
    }));
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      try {
        await createPost({
          title: state.title,
          description: state.description,
          industry: state.industry,
          contentType: state.contentType,
          format: state.format,
          mediaUrls: state.mediaUrls,
          style: {
            styleProductionValue: state.styleProductionValue,
            stylePacing: state.stylePacing,
            styleFocus: state.styleFocus,
            styleFraming: state.styleFraming,
            styleStaging: state.styleStaging,
            styleColor: state.styleColor,
            styleSound: state.styleSound,
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  const step1Valid = state.mediaUrls.length > 0;
  const step2Valid = state.industry.trim().length > 0;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          addImagesFromFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <StepIndicator current={step} />

      {step === 1 && (
        <StepOne
          state={state}
          set={set}
          onPickFiles={() => fileInputRef.current?.click()}
          onRemoveImage={removeImage}
          uploading={uploading}
        />
      )}
      {step === 2 && <StepTwo state={state} set={set} />}
      {step === 3 && (
        <StepThree state={state} set={set} defaultStyle={defaultStyle} />
      )}

      <section className="border-border flex items-center justify-between gap-3 border-t pt-6">
        {step > 1 ? (
          <Button
            variant="ghost"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            disabled={pending}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        {step < TOTAL_STEPS ? (
          <Button
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            disabled={
              (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
            }
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={publish} disabled={pending || !step1Valid}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Publishing…" : "Publish"}
          </Button>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { i: 1, label: "Pictures & text" },
    { i: 2, label: "Categorize" },
    { i: 3, label: "Style" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, idx) => {
        const active = current === s.i;
        const done = current > s.i;
        return (
          <li
            key={s.i}
            className={cn(
              "inline-flex items-center gap-1.5",
              active
                ? "text-foreground"
                : done
                  ? "text-foreground/70"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "bg-foreground/20 text-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {s.i}
            </span>
            <span className="font-medium">{s.label}</span>
            {idx < steps.length - 1 && (
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Pictures + title + description
// ---------------------------------------------------------------------------

function StepOne({
  state,
  set,
  onPickFiles,
  onRemoveImage,
  uploading,
}: {
  state: State;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
  onPickFiles: () => void;
  onRemoveImage: (i: number) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Label>Pictures</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {state.mediaUrls.map((src, i) => (
            <div
              key={i}
              className="border-border bg-muted relative aspect-square overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Upload ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(i)}
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onPickFiles}
            disabled={uploading}
            className="border-border bg-muted/30 hover:bg-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground flex aspect-square items-center justify-center rounded-xl border border-dashed transition-colors disabled:opacity-60"
          >
            <div className="flex flex-col items-center gap-1 text-xs">
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : state.mediaUrls.length === 0 ? (
                <>
                  <ImageIcon className="h-5 w-5" />
                  <span>Add picture</span>
                </>
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </div>
          </button>
        </div>
        <p className="text-muted-foreground text-xs">
          Drop multiple pictures to build a series. The first picture
          becomes the hero of your post and the cover in the feed.
        </p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          value={state.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Golden Hour Crossing"
        />
      </section>

      <section className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          rows={4}
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="A few sentences about the shoot, the client, or the story behind the work."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Categorization
// ---------------------------------------------------------------------------

function StepTwo({
  state,
  set,
}: {
  state: State;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Label>Industry</Label>
        <ChipGroup
          options={INDUSTRY_EXPERIENCE}
          value={state.industry ? [state.industry] : []}
          onChange={(v) => set("industry", v[0] ?? "")}
          allowMultiple={false}
        />
        <p className="text-muted-foreground text-xs">
          Drives matching against startup briefs.
        </p>
      </section>

      <section className="space-y-3">
        <Label>Content type</Label>
        <ChipGroup
          options={DELIVERABLE_TYPES}
          value={state.contentType ? [state.contentType] : []}
          onChange={(v) => set("contentType", v[0] ?? "")}
          allowMultiple={false}
        />
      </section>

      <section className="space-y-3">
        <Label>Format</Label>
        <ChipGroup
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
            { value: "square", label: "Square" },
          ]}
          value={[state.format]}
          onChange={(v) =>
            set(
              "format",
              (v[0] as "horizontal" | "vertical" | "square") ?? "horizontal",
            )
          }
          allowMultiple={false}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Style dimensions (optional)
// ---------------------------------------------------------------------------

function StepThree({
  state,
  set,
  defaultStyle,
}: {
  state: State;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
  defaultStyle: Partial<Record<StyleKey, number>>;
}) {
  function valueFor(key: StyleKey): number {
    return (state[key] as number | null) ?? defaultStyle[key] ?? 5;
  }
  function isOverride(key: StyleKey): boolean {
    return state[key] != null;
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Set the seven dimensions to describe THIS post specifically. Skip
        anything you don&apos;t want to override — those values inherit from
        your profile&apos;s defaults.
      </p>
      {STYLE_DIMENSIONS.map((dim) => {
        const val = valueFor(dim.key);
        const override = isOverride(dim.key);
        return (
          <div
            key={dim.key}
            className="border-border bg-card rounded-xl border p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">{dim.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {val} / 10
                </span>
                {override ? (
                  <button
                    type="button"
                    onClick={() => set(dim.key, null)}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                  >
                    Reset to profile
                  </button>
                ) : (
                  <span className="text-muted-foreground text-[11px]">
                    inherits
                  </span>
                )}
              </div>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[val]}
              onValueChange={(v) => set(dim.key, toArr(v)[0] ?? 5)}
            />
            <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
              <span>{dim.low}</span>
              <span>{dim.high}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
