"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveMembershipTier } from "@/app/membership/actions";

const FREE_FEATURES = [
  "Unified feed of creators + briefs",
  "Profile-level match score",
  "Direct messaging with any profile",
  "Appear in search and matching results",
];

const PRO_CREATOR_FEATURES = [
  "Everything in Free",
  "Project-level matching (be a top pick for specific briefs)",
  "Standardized glimpse. contracts",
  "In-app project manager (milestones + file handoff)",
];

const PRO_STARTUP_FEATURES = [
  "Everything in Free",
  "Post project briefs with reference images + description",
  "Creators ranked against your specific brief",
  "Standardized glimpse. contracts",
  "In-app project manager + milestone tracking",
  "Escrow downpayment handling",
  "Priority support",
];

export function MembershipPicker({
  userType,
}: {
  userType: "creator" | "startup";
}) {
  const [picked, setPicked] = useState<"free" | "pro">("pro");
  const [pending, startTransition] = useTransition();

  const proPrice = userType === "startup" ? "€300" : "€50";
  const proYearly = userType === "startup" ? "€3,000" : "€500";
  const features =
    userType === "startup" ? PRO_STARTUP_FEATURES : PRO_CREATOR_FEATURES;

  function submit() {
    startTransition(async () => {
      await saveMembershipTier(picked);
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Free */}
        <button
          type="button"
          onClick={() => setPicked("free")}
          className={cn(
            "bg-card relative flex flex-col rounded-3xl border p-8 text-left transition-all",
            picked === "free"
              ? "border-foreground shadow-[0_0_0_3px_rgba(26,26,26,0.08)]"
              : "border-border hover:border-foreground/20",
          )}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-medium">Free</h3>
            <p className="text-muted-foreground text-sm">forever</p>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Profile-level matching. Reach out to anyone.
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-medium">€0</span>
            <span className="text-muted-foreground text-sm">/ month</span>
          </div>
          <ul className="mt-8 space-y-3">
            {FREE_FEATURES.map((f) => (
              <FeatureRow key={f} label={f} />
            ))}
          </ul>
        </button>

        {/* Pro */}
        <button
          type="button"
          onClick={() => setPicked("pro")}
          className={cn(
            "relative flex flex-col rounded-3xl border p-8 text-left transition-all",
            picked === "pro"
              ? "bg-foreground text-background border-foreground shadow-lg"
              : "bg-card border-border hover:border-foreground/20",
          )}
        >
          <div
            className={cn(
              "absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider",
              picked === "pro"
                ? "bg-[var(--match)] text-white"
                : "bg-foreground text-background",
            )}
          >
            <Sparkles className="h-3 w-3" /> Recommended
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-medium">Pro</h3>
            <p
              className={cn(
                "text-sm",
                picked === "pro" ? "text-background/70" : "text-muted-foreground",
              )}
            >
              project-level matching
            </p>
          </div>
          <p
            className={cn(
              "mt-2 text-sm",
              picked === "pro" ? "text-background/80" : "text-muted-foreground",
            )}
          >
            Be matched to specific company briefs — not just profiles.
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-medium">{proPrice}</span>
            <span
              className={cn(
                "text-sm",
                picked === "pro"
                  ? "text-background/70"
                  : "text-muted-foreground",
              )}
            >
              / month
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              picked === "pro" ? "text-background/70" : "text-muted-foreground",
            )}
          >
            or {proYearly} / year
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <FeatureRow key={f} label={f} dark={picked === "pro"} />
            ))}
          </ul>
        </button>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={submit}
          disabled={pending}
          size="lg"
          className="h-12 px-10 text-base"
        >
          {pending
            ? "Saving…"
            : picked === "pro"
              ? "Continue with Pro"
              : "Continue with Free"}
        </Button>
      </div>
    </>
  );
}

function FeatureRow({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          dark ? "bg-background/15" : "bg-foreground/10",
        )}
      >
        <Check className={cn("h-3 w-3", dark ? "text-background" : "")} />
      </div>
      <span className={dark ? "text-background" : "text-foreground"}>
        {label}
      </span>
    </li>
  );
}
