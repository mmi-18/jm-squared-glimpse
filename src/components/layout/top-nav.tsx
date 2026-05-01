"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Inbox,
  Sparkles,
  LayoutGrid,
  LogOut,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/brand/avatar";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

type NavUser =
  | {
      id: string;
      name: string | null;
      image: string | null;
      userType: "creator" | "startup";
      membershipTier: "free" | "pro";
    }
  | null;

export function TopNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const tabs =
    user?.userType === "startup"
      ? [
          { href: "/feed", label: "Feed", icon: LayoutGrid },
          { href: "/brief", label: "Brief", icon: Sparkles },
          { href: "/inbox", label: "Inbox", icon: Inbox },
        ]
      : [
          { href: "/feed", label: "Feed", icon: LayoutGrid },
          { href: "/inbox", label: "Inbox", icon: Inbox },
        ];

  return (
    <header
      className="border-border bg-background sticky top-0 z-30 hidden border-b backdrop-blur md:block"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo href="/feed" size="md" />
          <nav className="flex items-center gap-6">
            {tabs.map((t) => {
              const active = pathname?.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.userType === "creator" && (
                <Link
                  href="/new-post"
                  className={buttonVariants({
                    size: "sm",
                    className: "h-8 gap-1",
                  })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New post
                </Link>
              )}
              {user.membershipTier === "pro" && (
                <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  Pro
                </span>
              )}
              {/* Profile pill — subtle button affordance so the click
                  target reads as interactive (was just plain text, which
                  users tended to overlook and misclick the SignOut icon
                  instead). pl-1 hugs the avatar tight, pr-3 gives
                  comfortable side around the name; the rounded-full +
                  hover:bg-muted is the same pattern shadcn uses for
                  ghost-style triggers. Larger click target, clearer
                  affordance — same href as before. */}
              <Link
                href={
                  user.userType === "creator"
                    ? `/creator/${user.id}`
                    : `/startup/${user.id}`
                }
                aria-label="Your profile"
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex min-h-[40px] items-center gap-2 rounded-full pl-1 pr-3 text-sm transition-colors"
              >
                <Avatar
                  src={user.image}
                  name={user.name}
                  size={32}
                />
                <span>{user.name ?? "Profile"}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants()}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
