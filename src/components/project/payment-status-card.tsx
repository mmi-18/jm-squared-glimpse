import { CheckCircle2, Clock, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Money-state widget on /project/<id>. Renders the deposit /
 * escrow / payout state in a single card so both parties see the
 * same source of truth for "where's my money."
 *
 * State machine (Chunk F-prep):
 *
 *   paidAt=null                       → no card (we're still in the
 *                                       deposit-gate UI on the
 *                                       agreement panel)
 *   paidAt set, status=active|delivered → "Deposit held in escrow"
 *   status=completed, payoutReleasedAt=null → "Payout scheduled for X"
 *   payoutReleasedAt set              → "Payout released"
 *   status=cancelled                  → "Refunded" (paidAt was cleared)
 *
 * Once Chunk F-stripe lands, this same component just gets the
 * Stripe receipt URL appended to "Deposit held in escrow" so users
 * can verify their payment.
 */

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PaymentStatusCard({
  paidAt,
  payoutScheduledFor,
  payoutReleasedAt,
  cancelledAt,
  priceCents,
  currency,
  viewerRole,
}: {
  paidAt: Date | null;
  payoutScheduledFor: Date | null;
  payoutReleasedAt: Date | null;
  cancelledAt: Date | null;
  priceCents: number | null;
  currency: string;
  viewerRole: "client" | "creator";
}) {
  // Don't render if there's no money story to tell yet.
  if (!paidAt && !cancelledAt) return null;

  const price = priceCents != null ? formatPrice(priceCents, currency) : null;
  const clientCharge =
    priceCents != null
      ? formatPrice(Math.round(priceCents * 1.1), currency)
      : null;
  const creatorTakehome =
    priceCents != null
      ? formatPrice(Math.round(priceCents * 0.95), currency)
      : null;

  // ─── Cancelled (refund) ─────────────────────────────────────────────
  if (cancelledAt) {
    return (
      <Card icon={Wallet} tone="muted">
        <Title>Project cancelled — deposit refunded</Title>
        <Body>
          Any held deposit has been returned to the client. No payout
          was made to the creator.
        </Body>
      </Card>
    );
  }

  // ─── Payout already released ────────────────────────────────────────
  if (payoutReleasedAt) {
    return (
      <Card icon={CheckCircle2} tone="green">
        <Title>Payout released</Title>
        <Body>
          {viewerRole === "creator" ? (
            <>
              {creatorTakehome ?? "Your payout"} was released to you on{" "}
              {formatDate(payoutReleasedAt)}.
            </>
          ) : (
            <>
              {creatorTakehome ?? "The creator's payout"} was released
              on {formatDate(payoutReleasedAt)}.
            </>
          )}
        </Body>
      </Card>
    );
  }

  // ─── Payout scheduled (signed off, waiting for 24h undo window) ─────
  if (payoutScheduledFor) {
    return (
      <Card icon={Clock} tone="amber">
        <Title>Payout scheduled</Title>
        <Body>
          {viewerRole === "creator" ? (
            <>
              {creatorTakehome ?? "Your payout"} releases on{" "}
              {formatDate(payoutScheduledFor)} — that&apos;s after the
              24-hour sign-off undo window closes.
            </>
          ) : (
            <>
              {creatorTakehome ?? "The creator's payout"} releases on{" "}
              {formatDate(payoutScheduledFor)}, after your 24-hour
              undo window closes. Pull the sign-off before then if
              something&apos;s wrong.
            </>
          )}
        </Body>
      </Card>
    );
  }

  // ─── Default: deposit held, work in progress ────────────────────────
  return (
    <Card icon={ShieldCheck} tone="blue">
      <Title>Deposit held in escrow</Title>
      <Body>
        {viewerRole === "client" ? (
          <>
            You deposited {clientCharge ?? "the agreed amount"} on{" "}
            {formatDate(paidAt!)}. The creator&apos;s payout (
            {creatorTakehome ?? price ?? "agreed amount"}) releases
            24 hours after your sign-off.
          </>
        ) : (
          <>
            The client&apos;s deposit landed on {formatDate(paidAt!)}.
            Your payout ({creatorTakehome ?? price ?? "agreed amount"})
            releases 24 hours after they sign off the deliverable.
          </>
        )}
      </Body>
    </Card>
  );
}

function Card({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "amber" | "green" | "muted";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "mb-6 flex items-start gap-3 rounded-2xl border p-4",
        tone === "blue" &&
          "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30",
        tone === "amber" &&
          "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30",
        tone === "green" &&
          "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30",
        tone === "muted" && "border-border bg-card",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          tone === "blue" && "text-blue-700 dark:text-blue-300",
          tone === "amber" && "text-amber-700 dark:text-amber-300",
          tone === "green" && "text-green-700 dark:text-green-300",
          tone === "muted" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </section>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed opacity-90">{children}</p>
  );
}
