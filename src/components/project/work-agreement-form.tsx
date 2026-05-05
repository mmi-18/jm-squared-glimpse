"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UsageRights } from "@/lib/types";
import type { AgreementInput } from "@/app/(app)/project/agreement-actions";

const USAGE_RIGHTS_OPTIONS: { value: UsageRights; label: string; hint: string }[] = [
  {
    value: "full_buyout",
    label: "Full buyout",
    hint: "All rights, all uses, in perpetuity. Highest fee — creator can no longer use the work in their own portfolio without permission.",
  },
  {
    value: "limited_platform",
    label: "Limited to listed platforms",
    hint: "Use only on the platforms named in the scope (e.g. Instagram + TikTok). Anything else needs renegotiation.",
  },
  {
    value: "time_limited",
    label: "Time-limited license",
    hint: "Use anywhere for a fixed window (e.g. 12 months). Reverts after.",
  },
  {
    value: "negotiable",
    label: "Open / to be negotiated",
    hint: "Defer the rights conversation — terms get spelled out in the deliverable handoff.",
  },
];

const DEFAULTS: AgreementInput = {
  title: "",
  scope: "",
  deliverables: "",
  priceEur: 0,
  deadline: "",
  revisionRounds: 2,
  usageRights: "limited_platform",
};

/**
 * The structured work-agreement form. Used in two places:
 *   - Hire flow (creator profile → modal → submit creates a new pending project)
 *   - Amend flow (project page when status=pending → reopens the form)
 *
 * Field shape mirrors `AgreementInput` from `agreement-actions.ts`. The
 * `onSubmit` callback receives the validated input + a setter for any
 * server-returned errors.
 */
export function WorkAgreementForm({
  initial,
  submitLabel,
  pendingLabel,
  helperHint,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AgreementInput>;
  submitLabel: string;
  pendingLabel?: string;
  /** Optional one-line hint rendered above the submit row. */
  helperHint?: string;
  onSubmit: (
    input: AgreementInput,
  ) => Promise<{ ok: true } | { ok: false; errors: string[] }>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<AgreementInput>({
    ...DEFAULTS,
    ...initial,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof AgreementInput>(
    key: K,
    value: AgreementInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    startTransition(async () => {
      const res = await onSubmit(form);
      if (!res.ok) setErrors(res.errors);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agreement-title">Project title</Label>
        <Input
          id="agreement-title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Brand film for Q3 product launch"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agreement-scope">Scope</Label>
        <Textarea
          id="agreement-scope"
          value={form.scope}
          onChange={(e) => update("scope", e.target.value)}
          placeholder="What's the project? Where will the work be used? Any creative direction?"
          rows={3}
          required
        />
        <p className="text-muted-foreground text-xs">
          A paragraph or two. Keep it specific — both sides will read this
          before accepting.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agreement-deliverables">Deliverables</Label>
        <Textarea
          id="agreement-deliverables"
          value={form.deliverables}
          onChange={(e) => update("deliverables", e.target.value)}
          placeholder={`e.g.
- 1× 60-second hero video, 9:16
- 3× 15-second cutdowns, 9:16
- Raw footage + project files`}
          rows={4}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agreement-price">Price (€)</Label>
          <Input
            id="agreement-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.priceEur || ""}
            onChange={(e) =>
              update("priceEur", Number.parseFloat(e.target.value) || 0)
            }
            placeholder="5000"
            required
          />
          <p className="text-muted-foreground text-xs">
            Face value. Platform fees (10% client / 5% creator) apply on top.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agreement-deadline">Deadline</Label>
          <Input
            id="agreement-deadline"
            type="date"
            value={form.deadline}
            onChange={(e) => update("deadline", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agreement-revisions">Revision rounds</Label>
        <Input
          id="agreement-revisions"
          type="number"
          inputMode="numeric"
          min="0"
          max="20"
          step="1"
          value={form.revisionRounds}
          onChange={(e) =>
            update("revisionRounds", Number.parseInt(e.target.value) || 0)
          }
        />
        <p className="text-muted-foreground text-xs">
          How many revision passes are baked into this price. Extra rounds
          would need a separate amendment.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agreement-rights">Usage rights</Label>
        <select
          id="agreement-rights"
          value={form.usageRights}
          onChange={(e) =>
            update("usageRights", e.target.value as UsageRights)
          }
          className="border-border bg-background min-h-[40px] w-full rounded-md border px-3 py-2 text-sm"
        >
          {USAGE_RIGHTS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          {
            USAGE_RIGHTS_OPTIONS.find((o) => o.value === form.usageRights)
              ?.hint
          }
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/30 p-3 text-sm">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {helperHint && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {helperHint}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? (pendingLabel ?? "Saving…") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
