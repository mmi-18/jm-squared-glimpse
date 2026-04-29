import { getCurrentUser } from "@/lib/auth";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <TopNav
        user={
          user
            ? {
                id: user.id,
                name: user.name ?? null,
                image: user.image ?? null,
                userType: user.userType as "creator" | "startup",
                membershipTier: user.membershipTier as "free" | "pro",
              }
            : null
        }
      />
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomNav
        userId={user?.id ?? null}
        userType={(user?.userType as "creator" | "startup" | undefined) ?? null}
      />
    </>
  );
}
