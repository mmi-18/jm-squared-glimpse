"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * Sign-out trigger. Lives on the profile page (creator + startup) so mobile
 * users have a way to sign out without a top nav. Default rendering is a
 * subtle, full-width row that fits at the bottom of the About section.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={cn(
        "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
