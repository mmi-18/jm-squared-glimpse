import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/feed");

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <Logo href="/" size="md" />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants()}>
              Get started
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="max-w-3xl text-5xl font-medium tracking-tight md:text-6xl">
            Creative freelancers.
            <br />
            Startups that get them.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg">
            glimpse. matches photo and video creators with startups on style,
            industry, and working preferences — not keyword search.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?type=creator"
              className={buttonVariants({
                size: "lg",
                className: "h-12 px-8 text-base",
              })}
            >
              I&apos;m a creator
            </Link>
            <Link
              href="/signup?type=startup"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "h-12 px-8 text-base",
              })}
            >
              I&apos;m a startup
            </Link>
          </div>
          <Link
            href="/feed"
            className="text-muted-foreground hover:text-foreground mt-8 text-sm underline-offset-4 hover:underline"
          >
            Or explore the feed first →
          </Link>
        </section>
      </div>
    </div>
  );
}
