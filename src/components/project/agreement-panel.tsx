"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Wallet,
} from "lucide-react";
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
  acceptAgreement,
  amendAgreement,
  markProjectPaid,
  type AgreementInput,
} from "@/app/(app)/project/agreement-actions";
import type { UsageRights } from "@/lib/types";
import { cn } from "@/lib/utils";

const USAGE_RIGHTS_LABEL: Record<UsageRights, string> = {
  full_buyout: "Full buyout",
  limited_platform: "Limited to listed platforms",
  time_limited: "Time-limited license",
  negotiable: "Open / to be negotiated",
};

function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDeadline(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(d);
}

function formatAcceptedAt(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export type AgreementSnapshot = {
  title: string;
  scope: string | null;
  deliverables: string | null;
  priceCents: number | null;
  currency: string;
  deadline: Date | null;
  revisionRounds: number | null;
  usageRights: UsageRights | null;
  clientAcceptedAt: Date | null;
  creatorAcceptedAt: Date | null;
  /** Set when the client has deposited (Chunk F-prep). Both-accepted
   *  + paidAt!=null is what flips status pending → active. */
  paidAt: Date | null;
};

/**
 * The pending-agreement panel shown on `/project/<id>` while
 * `status === "pending"`. Renders the current draft terms, both
 * parties' acceptance state, and the action buttons appropriate to
 * the viewer:
 *
 *   - If the viewer has already accepted: only "Amend" is available
 *     (counter-proposal); they can't "double-accept".
 *   - If the viewer hasn't accepted: both "Accept" and "Amend" are
 *     visible. Amend opens the same form pre-populated with current
 *     terms; submitting clears the *other* party's acceptance.
 *
 * Once both sides have accepted, the parent page no longer renders
 * this component (status flips to active and the existing project
 * action bar takes over).
 */
export function AgreementPanel({
  projectId,
  agreement,
  viewerRole,
  viewerCanEdit,
  clientName,
  creatorName,
}: {
  projectId: string;
  agreement: AgreementSnapshot;
  viewerRole: "client" | "creator";
  /** False if the project is read-only (e.g. cancelled). */
  viewerCanEdit: boolean;
  clientName: string;
  creatorName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAmend, setShowAmend] = useState(false);

  const viewerAcceptedAt =
    viewerRole === "client"
      ? agreement.clientAcceptedAt
      : agreement.creatorAcceptedAt;
  const counterAcceptedAt =
    viewerRole === "client"
      ? agreement.creatorAcceptedAt
      : agreement.clientAcceptedAt;
  const counterRoleLabel =
    viewerRole === "client" ? "creator" : "client";
  const counterName = viewerRole === "client" ? creatorName : clientName;

  // Are the terms currently complete enough to accept?
  const isComplete =
    !!agreement.scope &&
    !!agreement.deliverables &&
    agreement.priceCents != null &&
    !!agreement.deadline &&
    agreement.revisionRounds != null &&
    !!agreement.usageRights;

  const initialFormValues: Partial<AgreementInput> = {
    title: agreement.title,
    scope: agreement.scope ?? "",
    deliverables: agreement.deliverables ?? "",
    priceEur: agreement.priceCents != null ? agreement.priceCents / 100 : 0,
    deadline: agreement.deadline
      ? agreement.deadline.toISOString().slice(0, 10)
      : "",
    revisionRounds: agreement.revisionRounds ?? 2,
    usageRights: agreement.usageRights ?? "limited_platform",
  };

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptAgreement(projectId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onDeposit() {
    setError(null);
    startTransition(async () => {
      const res = await markProjectPaid(projectId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Chunk F-prep: both parties have accepted but the client hasn't
  // paid the deposit yet. The agreement panel sticks around in this
  // state so the deposit CTA has somewhere to live.
  const bothAccepted =
    agreement.clientAcceptedAt != null &&
    agreement.creatorAcceptedAt != null;
  const awaitingDeposit = bothAccepted && agreement.paidAt == null;

  async function onAmendSubmit(input: AgreementInput) {
    const res = await amendAgreement({ projectId, agreement: input });
    if (res.ok) {
      setShowAmend(false);
      router.refresh();
    }
    return res;
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      {/* Header bar */}
      <header className="border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
            Work agreement
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {awaitingDeposit
              ? viewerRole === "client"
                ? "Both accepted — deposit to start"
                : `Both accepted — waiting on ${clientName} to deposit`
              : viewerAcceptedAt && !counterAcceptedAt
                ? `Waiting on ${counterName} to accept`
                : !viewerAcceptedAt && counterAcceptedAt
                  ? `${counterName} accepted — your turn`
                  : "Drafting terms"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <AcceptedPill
            who="client"
            acceptedAt={agreement.clientAcceptedAt}
            isYou={viewerRole === "client"}
          />
          <AcceptedPill
            who="creator"
            acceptedAt={agreement.creatorAcceptedAt}
            isYou={viewerRole === "creator"}
          />
        </div>
      </header>

      {/* Terms grid */}
      <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
        <Field label="Scope">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {agreement.scope || (
              <span className="text-muted-foreground italic">Not yet set</span>
            )}
          </p>
        </Field>
        <Field label="Deliverables">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {agreement.deliverables || (
              <span className="text-muted-foreground italic">Not yet set</span>
            )}
          </p>
        </Field>
        <Field label="Price">
          {agreement.priceCents != null ? (
            <p className="text-sm font-medium">
              {formatPrice(agreement.priceCents, agreement.currency)}
              <span className="text-muted-foreground font-normal">
                {" "}
                face value
              </span>
            </p>
          ) : (
            <span className="text-muted-foreground text-sm italic">
              Not yet set
            </span>
          )}
        </Field>
        <Field label="Deadline">
          {agreement.deadline ? (
            <p className="text-sm">{formatDeadline(agreement.deadline)}</p>
          ) : (
            <span className="text-muted-foreground text-sm italic">
              Not yet set
            </span>
          )}
        </Field>
        <Field label="Revision rounds">
          {agreement.revisionRounds != null ? (
            <p className="text-sm">{agreement.revisionRounds}</p>
          ) : (
            <span className="text-muted-foreground text-sm italic">
              Not yet set
            </span>
          )}
        </Field>
        <Field label="Usage rights">
          {agreement.usageRights ? (
            <p className="text-sm">
              {USAGE_RIGHTS_LABEL[agreement.usageRights]}
            </p>
          ) : (
            <span className="text-muted-foreground text-sm italic">
              Not yet set
            </span>
          )}
        </Field>
      </dl>

      {/* Action footer */}
      {viewerCanEdit && (
        <footer className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
          {error && (
            <p className="text-destructive mr-auto text-xs">{error}</p>
          )}

          {/* Deposit gate (Chunk F-prep): both parties have accepted,
              now the client funds the project. The button only renders
              for the client; the creator just sees the header status
              ("Both accepted — waiting on …Client to deposit"). */}
          {awaitingDeposit && viewerRole === "client" && (
            <Button
              size="sm"
              onClick={onDeposit}
              disabled={pending || agreement.priceCents == null}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              {pending
                ? "Processing…"
                : `Deposit ${
                    agreement.priceCents != null
                      ? new Intl.NumberFormat("en-IE", {
                          style: "currency",
                          currency: agreement.currency,
                          minimumFractionDigits: 0,
                        }).format((agreement.priceCents * 1.1) / 100)
                      : "€0"
                  } to start`}
            </Button>
          )}

          {/* Pre-deposit phase: accept / amend / counter-propose. None
              of these render once we're in the deposit phase. */}
          {!awaitingDeposit && !viewerAcceptedAt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAmend(true)}
              disabled={pending}
            >
              <Pencil className="h-3.5 w-3.5" /> Amend terms
            </Button>
          )}
          {!awaitingDeposit && viewerAcceptedAt && !counterAcceptedAt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAmend(true)}
              disabled={pending}
            >
              <Pencil className="h-3.5 w-3.5" /> Counter-propose
            </Button>
          )}
          {!awaitingDeposit && !viewerAcceptedAt && (
            <Button
              size="sm"
              onClick={onAccept}
              disabled={pending || !isComplete}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept terms
            </Button>
          )}
        </footer>
      )}

      <Dialog open={showAmend} onOpenChange={setShowAmend}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Amend agreement</DialogTitle>
            <DialogDescription>
              Editing any field counts as your acceptance of the new
              terms. {counterName} will need to re-accept before work
              starts.
            </DialogDescription>
          </DialogHeader>
          <WorkAgreementForm
            initial={initialFormValues}
            submitLabel="Send updated terms"
            pendingLabel="Saving…"
            helperHint={`Submitting will clear the ${counterRoleLabel}'s acceptance — they'll re-accept.`}
            onSubmit={onAmendSubmit}
            onCancel={() => setShowAmend(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function AcceptedPill({
  who,
  acceptedAt,
  isYou,
}: {
  who: "client" | "creator";
  acceptedAt: Date | null;
  isYou: boolean;
}) {
  const accepted = acceptedAt != null;
  const tooltip = accepted
    ? `Accepted ${formatAcceptedAt(acceptedAt!)}`
    : "Not yet accepted";
  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        accepted
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {accepted ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isYou ? "You" : who === "client" ? "Client" : "Creator"}
    </span>
  );
}
