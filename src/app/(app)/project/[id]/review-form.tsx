"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitReview } from "@/app/(app)/project/actions";

/**
 * Two-way blind review form. Renders four 1-5 star scales + an optional
 * free-text field. On submit, the server action stores the row with
 * `released=false` until the counterparty also submits.
 *
 * Lives inline on /project/[id] when:
 *   - project status === "completed"
 *   - signedOffAt is past
 *   - the current viewer hasn't already submitted their direction
 */

const DIMENSIONS = [
  {
    key: "ratingOverall",
    label: "Overall",
    hint: "How was the collaboration overall?",
  },
  {
    key: "ratingReliability",
    label: "Reliability",
    hint: "Did they hit deadlines and respond reliably?",
  },
  {
    key: "ratingQuality",
    label: "Quality",
    hint: "How was the quality of the work / brief?",
  },
  {
    key: "ratingCollaboration",
    label: "Collaboration",
    hint: "Easy to work with? Communication clear?",
  },
] as const;

type Dim = (typeof DIMENSIONS)[number]["key"];

export function ReviewForm({
  projectId,
  counterpartyName,
  viewerRole,
}: {
  projectId: string;
  counterpartyName: string | null;
  viewerRole: "client" | "creator";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [ratings, setRatings] = useState<Record<Dim, number>>({
    ratingOverall: 0,
    ratingReliability: 0,
    ratingQuality: 0,
    ratingCollaboration: 0,
  });

  function setStar(key: Dim, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    if (Object.values(ratings).some((v) => v < 1)) {
      setError("Please rate all four dimensions before submitting.");
      return;
    }
    startTransition(async () => {
      try {
        await submitReview({
          projectId,
          ratingOverall: ratings.ratingOverall,
          ratingReliability: ratings.ratingReliability,
          ratingQuality: ratings.ratingQuality,
          ratingCollaboration: ratings.ratingCollaboration,
          text: text.trim() || null,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit review");
      }
    });
  }

  const counterparty = counterpartyName ?? "the other party";

  return (
    <section className="border-border bg-card mt-6 rounded-2xl border p-6">
      <h2 className="text-lg font-medium">
        Rate your collaboration with {counterparty}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Reviews are <strong>two-way blind</strong>: neither side sees the
        other&apos;s rating until both have submitted (or 14 days pass). Be
        honest — your feedback shapes how matches are made.
      </p>

      <div className="mt-6 space-y-5">
        {DIMENSIONS.map((d) => (
          <div key={d.key}>
            <div className="flex items-baseline justify-between">
              <Label className="text-sm font-medium">{d.label}</Label>
              <span className="text-muted-foreground text-xs">{d.hint}</span>
            </div>
            <Stars
              value={ratings[d.key]}
              onChange={(v) => setStar(d.key, v)}
              disabled={pending}
            />
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="reviewText" className="text-sm font-medium">
            Anything to add? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="reviewText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder={
              viewerRole === "client"
                ? "What stood out about working with them?"
                : "How did the brief and feedback land?"
            }
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </section>
  );
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div
      className="mt-2 flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={cn(
            "p-1 transition-colors",
            disabled && "opacity-50",
          )}
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              n <= display
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
      <span className="text-muted-foreground ml-2 text-sm">
        {value > 0 ? `${value} / 5` : "Pick a rating"}
      </span>
    </div>
  );
}
