import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BriefComposer } from "@/app/(app)/brief/brief-composer";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Brief feature is for startups only
  if (user.userType !== "startup") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <Sparkles className="text-muted-foreground mx-auto h-8 w-8" />
        <h1 className="mt-4 text-2xl font-medium tracking-tight">
          Briefs are for startups
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Creators get matched <em>into</em> briefs — you&apos;ll see project
          matches appear in your feed and inbox when a company&apos;s brief
          matches your work.
        </p>
        <Link href="/feed" className={buttonVariants({ className: "mt-6" })}>
          Back to feed
        </Link>
      </div>
    );
  }

  const isPro = user.membershipTier === "pro";

  if (!isPro) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="border-border bg-card rounded-3xl border p-10 text-center">
          <div className="bg-warm mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-medium tracking-tight">
            Project briefs are a Pro feature
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">
            On Free, you get profile-level matching — you reach out to creators
            whose style fits your brand. Pro unlocks{" "}
            <span className="text-foreground font-medium">
              project-level matching
            </span>
            : describe a specific project, upload reference images, and have
            creators ranked against it.
          </p>
          <Link
            href="/membership"
            className={buttonVariants({ className: "mt-6 h-11 px-6" })}
          >
            Upgrade to Pro
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const activeBrief = await db.brief.findFirst({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-8">
        <div className="bg-warm inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> Pro feature
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          Your project brief
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Describe what you&apos;re looking for. Creators whose work fits will
          be flagged as <span className="font-medium">Top picks</span> in your
          feed.
        </p>
      </div>

      <BriefComposer
        initial={
          activeBrief
            ? {
                title: activeBrief.title,
                description: activeBrief.description,
                referenceUrls: activeBrief.referenceImageUrls ?? [],
              }
            : null
        }
      />
    </div>
  );
}
