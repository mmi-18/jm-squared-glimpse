import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PostEditor } from "@/app/(app)/new-post/post-editor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.userType !== "creator") {
    redirect("/brief");
  }

  // Pull the creator's profile so the wizard can default industry, content
  // type, and the 7 style dimensions from the user's baseline. The user
  // can override any of them in step 2 / step 3.
  const profile = await db.creatorProfile.findUnique({
    where: { userId: user.id },
  });

  const defaultIndustry = profile?.industryExperience?.[0] ?? "";
  const defaultContentType = profile?.deliverableTypes?.[0] ?? "photo_series";
  const defaultStyle = {
    styleProductionValue: profile?.styleProductionValue ?? undefined,
    stylePacing: profile?.stylePacing ?? undefined,
    styleFocus: profile?.styleFocus ?? undefined,
    styleFraming: profile?.styleFraming ?? undefined,
    styleStaging: profile?.styleStaging ?? undefined,
    styleColor: profile?.styleColor ?? undefined,
    styleSound: profile?.styleSound ?? undefined,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/feed"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-medium tracking-tight">New post</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Three quick steps. Pictures and a title first, then categorization,
          then optional style refinement.
        </p>
      </header>

      <PostEditor
        defaultIndustry={defaultIndustry}
        defaultContentType={defaultContentType}
        defaultStyle={defaultStyle}
      />
    </div>
  );
}
