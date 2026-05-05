"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Inbox,
  Sparkles,
  LayoutGrid,
  UserRound,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  userId,
  userType,
  projectsAttentionCount = 0,
}: {
  userId: string | null;
  userType: "creator" | "startup" | null;
  projectsAttentionCount?: number;
}) {
  const pathname = usePathname();
  const profileHref =
    userId && userType
      ? userType === "creator"
        ? `/creator/${userId}`
        : `/startup/${userId}`
      : "/login";

  // Mobile bottom nav — limited to 5 slots for thumb-reachability.
  // Drops "Brief" and "New post" buttons (less-frequent surfaces) in
  // favour of Projects, which is now the second-most-used tab after
  // the Feed. Briefs can still be reached via the top bar on desktop;
  // creators get to /new-post via the FAB on /feed (unchanged).
  const tabs =
    userType === "startup"
      ? [
          { href: "/feed", label: "Feed", icon: LayoutGrid },
          {
            href: "/projects",
            label: "Projects",
            icon: Briefcase,
            badge: projectsAttentionCount,
          },
          { href: "/brief", label: "Brief", icon: Sparkles },
          { href: "/inbox", label: "Inbox", icon: Inbox },
          { href: profileHref, label: "Profile", icon: UserRound },
        ]
      : userType === "creator"
        ? [
            { href: "/feed", label: "Feed", icon: LayoutGrid },
            {
              href: "/projects",
              label: "Projects",
              icon: Briefcase,
              badge: projectsAttentionCount,
            },
            { href: "/new-post", label: "Post", icon: Plus },
            { href: "/inbox", label: "Inbox", icon: Inbox },
            { href: profileHref, label: "Profile", icon: UserRound },
          ]
        : [
            { href: "/feed", label: "Feed", icon: LayoutGrid },
            { href: "/inbox", label: "Inbox", icon: Inbox },
            { href: profileHref, label: "Profile", icon: UserRound },
          ];

  return (
    <nav
      className="bg-background border-border fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((t) => {
        const active =
          pathname === t.href ||
          (t.href !== "/" && pathname?.startsWith(t.href));
        const Icon = t.icon;
        const badge = ("badge" in t ? t.badge : 0) ?? 0;
        return (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 text-[11px] transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
              {badge > 0 && (
                <span className="bg-amber-500 text-white absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
