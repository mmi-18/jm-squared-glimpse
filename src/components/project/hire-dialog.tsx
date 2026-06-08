"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkAgreementForm } from "@/components/project/work-agreement-form";
import {
  hireCreator,
  type AgreementInput,
} from "@/app/(app)/project/agreement-actions";
import { cn } from "@/lib/utils";

type BriefOption = {
  id: string;
  title: string;
  description: string;
  deliverableMedium: string | null;
  deliverablePlatforms: string[];
  deliverableCountMin: number | null;
  deliverableCountMax: number | null;
  deliverableDuration: string | null;
};

const MEDIUM_LABEL: Record<string, string> = {
  photo: "Photo",
  video: "Video",
  to_be_determined: "TBD",
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  website: "Website",
  event: "Event",
  cinema: "Cinema",
  internal: "Internal",
  to_be_determined: "TBD",
};

const DURATION_LABEL: Record<string, string> = {
  under_15s: "<15s",
  from_15_to_30s: "15–30s",
  from_30_to_60s: "30–60s",
  from_1_to_3_min: "1–3 min",
  over_3_min: "3+ min",
  not_applicable: "n/a",
};

/**
 * Turn a structured Brief into a human-readable deliverables string
 * suitable as the pre-fill for the agreement form's "deliverables"
 * field. Pattern (skipping unset pieces gracefully):
 *
 *   "3-5 Video for Instagram, TikTok (30-60s)"
 *   "10 Photo for Website"
 *   "Quantity TBD"
 */
function synthesizeDeliverables(b: BriefOption): string {
  const parts: string[] = [];

  // Count: "3" or "3-5" depending on range
  if (b.deliverableCountMin != null && b.deliverableCountMax != null) {
    parts.push(
      b.deliverableCountMin === b.deliverableCountMax
        ? `${b.deliverableCountMin}`
        : `${b.deliverableCountMin}-${b.deliverableCountMax}`,
    );
  }

  // Medium: "Video" / "Photo"
  if (b.deliverableMedium && MEDIUM_LABEL[b.deliverableMedium]) {
    parts.push(MEDIUM_LABEL[b.deliverableMedium]);
  }

  // Platforms: "for Instagram, TikTok"
  if (b.deliverablePlatforms.length > 0) {
    const labels = b.deliverablePlatforms
      .map((p) => PLATFORM_LABEL[p])
      .filter(Boolean)
      .join(", ");
    if (labels) parts.push(`for ${labels}`);
  }

  // Duration: "(30-60s)" — bracketed at the end
  if (b.deliverableDuration && DURATION_LABEL[b.deliverableDuration]) {
    parts.push(`(${DURATION_LABEL[b.deliverableDuration]})`);
  }

  return parts.join(" ").trim();
}

/**
 * "Hire <creator>" entry point. Opens a modal with the structured
 * work-agreement form. Submitting creates a Project in `pending`
 * with the client's acceptance pre-set, then redirects to the
 * project page so the creator can review + accept (visible on their
 * inbox / project list).
 *
 * If the viewing startup has any active Briefs (posted jobs), the
 * dialog opens with a "Hiring for…" picker — they can select an
 * existing brief to pre-fill title + scope from, or pick "A new
 * project" for a blank form. All fields stay editable after the
 * pre-fill — the brief is the *starting point*, not a lock-in.
 *
 * Visibility rules are enforced by the parent — only render this
 * for startups viewing creator profiles.
 */
export function HireDialog({
  creatorId,
  creatorName,
  isAuthenticated,
  activeBriefs = [],
  trigger,
}: {
  creatorId: string;
  creatorName: string;
  isAuthenticated: boolean;
  /** The viewing startup's active briefs, if any. Pulled by the
   *  parent server component so we don't add a client-side fetch. */
  activeBriefs?: BriefOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Which brief (if any) is currently selected as the source.
  // null = "A new project" (default; blank form). When a real
  // brief is picked, its id goes here and the form re-mounts with
  // pre-filled title + scope.
  const [sourceBriefId, setSourceBriefId] = useState<string | null>(null);

  function onTriggerClick() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  function reset() {
    // When the dialog closes, drop any picked source so the next
    // open starts fresh.
    setSourceBriefId(null);
  }

  async function handleSubmit(input: AgreementInput) {
    const res = await hireCreator({ creatorId, agreement: input });
    if (res.ok) {
      setOpen(false);
      reset();
      router.push(`/project/${res.projectId}`);
      router.refresh();
    }
    return res;
  }

  const sourceBrief = activeBriefs.find((b) => b.id === sourceBriefId) ?? null;

  // Pre-fill values when a brief is picked. Brief → agreement mapping:
  //   title          → title
  //   description    → scope (free-text → free-text)
  //   structured     → deliverables (synthesized human-readable string
  //                    from medium / platforms / count / duration)
  // Other agreement fields (price / deadline / revisions / usage rights)
  // have no direct mapping yet — startup fills them in.
  const initialFromBrief: Partial<AgreementInput> | undefined = sourceBrief
    ? {
        title: sourceBrief.title,
        scope: sourceBrief.description,
        deliverables: synthesizeDeliverables(sourceBrief),
      }
    : undefined;

  return (
    <>
      <span
        onClick={onTriggerClick}
        className="inline-flex cursor-pointer"
      >
        {trigger ?? (
          <Button>
            <Briefcase className="size-4" /> Hire {creatorName.split(" ")[0]}
          </Button>
        )}
      </span>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hire {creatorName}</DialogTitle>
            <DialogDescription>
              Set the terms. {creatorName.split(" ")[0]} reviews these
              and either accepts or counters before any work starts.
              You can edit before they accept; once both sides accept,
              the project goes active.
            </DialogDescription>
          </DialogHeader>

          {/* Source picker — visible only when the startup has at
              least one active brief. Otherwise we skip straight to
              the blank form (current behaviour). */}
          {activeBriefs.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Hiring for
              </p>
              <div className="grid gap-2">
                <SourceOption
                  selected={sourceBriefId === null}
                  onClick={() => setSourceBriefId(null)}
                  icon={Plus}
                  label="A new project"
                  hint="Start with a blank form"
                />
                {activeBriefs.map((b) => (
                  <SourceOption
                    key={b.id}
                    selected={sourceBriefId === b.id}
                    onClick={() => setSourceBriefId(b.id)}
                    icon={FileText}
                    label={b.title}
                    hint="Pre-fill title + scope from this posted job"
                  />
                ))}
              </div>
            </div>
          )}

          {/* The form re-mounts when source changes, so `initial`
              fires its useState initializer afresh. */}
          <WorkAgreementForm
            key={sourceBriefId ?? "blank"}
            initial={initialFromBrief}
            submitLabel={`Send offer to ${creatorName.split(" ")[0]}`}
            pendingLabel="Sending offer…"
            helperHint={
              sourceBrief
                ? "Pre-filled from your posted job — edit anything before sending. Submitting counts as your acceptance of these terms."
                : "Submitting this counts as your acceptance of these terms."
            }
            onSubmit={handleSubmit}
            onCancel={() => {
              setOpen(false);
              reset();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SourceOption({
  selected,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-foreground/40 bg-muted/40"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-foreground bg-foreground"
            : "border-border bg-background",
        )}
      >
        {selected && (
          <span className="bg-background block h-1.5 w-1.5 rounded-full" />
        )}
      </div>
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    </button>
  );
}
