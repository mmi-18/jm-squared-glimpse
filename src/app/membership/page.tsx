import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Smartphone, Apple } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { MembershipPicker } from "@/app/membership/membership-picker";

export const dynamic = "force-dynamic";

const QR_URL =
  "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=" +
  encodeURIComponent("https://glimpse.app/mobile");

export default async function MembershipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isCreator = user.userType === "creator";

  return (
    <div className="bg-surface min-h-screen">
      <header className="border-border border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/" size="md" />
          <Link
            href="/feed"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Skip for now →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-medium tracking-tight md:text-5xl">
            Choose your membership
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            <span className="font-medium text-foreground">Free</span>{" "}
            matchmakes profiles with companies.{" "}
            <span className="font-medium text-foreground">Pro</span> matchmakes
            specific company projects with available creators.
          </p>
        </div>

        {/* Picker for the user's own side */}
        <div className="mt-12">
          <MembershipPicker
            userType={user.userType as "creator" | "startup"}
          />
        </div>

        {/* Trust / commission */}
        <section className="border-border bg-card mt-16 rounded-3xl border p-8 md:p-10">
          <h2 className="text-center text-2xl font-medium tracking-tight">
            Transparent, fair commission
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center">
            Transparency matters to us. We publish exactly what we take and
            what you get back.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <CommissionCard label="Companies" value="10%" detail="per project" />
            <CommissionCard
              label="Creators"
              value="5%"
              detail="per project"
            />
            <CommissionCard
              label="Industry average"
              value="20–30%"
              detail="through agencies"
              muted
            />
          </div>

          <p className="mt-6 rounded-xl bg-[var(--match)]/10 text-[var(--match)] p-4 text-center text-sm font-medium">
            That&apos;s roughly half the commission of a standard creative
            agency.
          </p>

          <div className="border-border mt-8 grid grid-cols-1 gap-6 border-t pt-8 md:grid-cols-2">
            <ValueProp
              title="Protected payment"
              body="The company pays a downpayment into escrow. We release it to the creator the moment the project starts and the first action step is taken — no ghosting, no chasing invoices."
            />
            <ValueProp
              title="Standardized contracts"
              body="Every Pro project runs on a vetted glimpse. contract. Usage rights, revisions, and payment terms are clear from day one — no lawyer needed."
            />
            <ValueProp
              title="Project manager built in"
              body="Pro accounts get an in-app project manager: milestones, file handoff, feedback loops, and sign-off all in one thread."
            />
            <ValueProp
              title="Real match intelligence"
              body="Our algorithm scores on style, industry, and working preferences — not keywords. Pro unlocks per-project matching too."
            />
          </div>
        </section>

        {/* Pricing overview (both sides, MVP demo) */}
        <section className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-medium tracking-tight">
              Full pricing overview
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Both creators and startups can stay on Free forever, or upgrade
              to Pro for project-level matching and protection.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <PricingOverviewCard
              side="Startup"
              freeMonthly="€0"
              proMonthly="€300"
              proYearly="€3,000"
              commission="10% commission per project"
              youAre={!isCreator}
            />
            <PricingOverviewCard
              side="Creator"
              freeMonthly="€0"
              proMonthly="€50"
              proYearly="€500"
              commission="5% commission per project"
              youAre={isCreator}
            />
          </div>
        </section>

        {/* Mobile app section */}
        <section className="border-border bg-card mt-16 flex flex-col items-center gap-8 rounded-3xl border p-8 md:flex-row md:justify-between md:p-12">
          <div className="max-w-md text-center md:text-left">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-warm px-3 py-1 text-xs font-medium">
              <Smartphone className="h-3.5 w-3.5" /> Also on your phone
            </div>
            <h2 className="text-2xl font-medium tracking-tight">
              The glimpse. app for iOS &amp; Android
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              Everything here, optimized for scrolling, swiping, and messaging
              on the go. Scan the QR to download.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <div className="border-border bg-foreground text-background flex items-center gap-2 rounded-xl border px-4 py-2 text-xs">
                <Apple className="h-4 w-4" />
                <div>
                  <p className="text-[10px] opacity-80">Download on</p>
                  <p className="font-medium">App Store</p>
                </div>
              </div>
              <div className="border-border bg-foreground text-background flex items-center gap-2 rounded-xl border px-4 py-2 text-xs">
                <Smartphone className="h-4 w-4" />
                <div>
                  <p className="text-[10px] opacity-80">Get it on</p>
                  <p className="font-medium">Google Play</p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-border bg-background flex flex-col items-center gap-2 rounded-2xl border p-4">
            <Image
              src={QR_URL}
              alt="QR code to download the glimpse. mobile app"
              width={180}
              height={180}
              unoptimized
            />
            <p className="text-muted-foreground text-xs">Scan with your phone</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function CommissionCard({
  label,
  value,
  detail,
  muted,
}: {
  label: string;
  value: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`border-border rounded-2xl border p-6 text-center ${
        muted ? "bg-muted/60" : "bg-background"
      }`}
    >
      <p className="text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`mt-2 text-4xl font-medium tracking-tight ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </div>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="bg-foreground text-background flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Check className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingOverviewCard({
  side,
  freeMonthly,
  proMonthly,
  proYearly,
  commission,
  youAre,
}: {
  side: string;
  freeMonthly: string;
  proMonthly: string;
  proYearly: string;
  commission: string;
  youAre: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        youAre
          ? "bg-foreground text-background border-foreground"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{side}</h3>
        {youAre && (
          <span className="bg-[var(--match)] rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
            You
          </span>
        )}
      </div>
      <p
        className={`mt-1 text-xs ${
          youAre ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {commission}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl border p-4 ${
            youAre ? "border-white/20" : "border-border"
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-wider ${
              youAre ? "text-background/70" : "text-muted-foreground"
            }`}
          >
            Free
          </p>
          <p className="mt-1 text-2xl font-medium">{freeMonthly}</p>
          <p
            className={`mt-1 text-[11px] ${
              youAre ? "text-background/70" : "text-muted-foreground"
            }`}
          >
            profile matching
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            youAre
              ? "bg-background text-foreground border-background"
              : "bg-warm border-warm"
          }`}
        >
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Pro
          </p>
          <p className="mt-1 text-2xl font-medium">{proMonthly}/mo</p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            or {proYearly}/yr
          </p>
        </div>
      </div>
    </div>
  );
}
