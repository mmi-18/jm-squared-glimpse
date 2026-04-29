"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Sparkles, LayoutGrid, UserRound, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  userId,
  userType,
}: {
  userId: string | null;
  userType: "creator" | "startup" | null;
}) {
  const pathname = usePathname();
  const profileHref =
    userId && userType
      ? userType === "creator"
        ? `/creator/${userId}`
        : `/startup/${userId}`
      : "/login";

  const tabs =
    userType === "startup"
      ? [
          { href: "/feed", label: "Feed", icon: LayoutGrid },
          { href: "/brief", label: "Brief", icon: Sparkles },
          { href: "/inbox", label: "Inbox", icon: Inbox },
          { href: profileHref, label: "Profile", icon: UserRound },
        ]
      : userType === "creator"
        ? [
            { href: "/feed", label: "Feed", icon: LayoutGrid },
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
        return (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 text-[11px] transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
