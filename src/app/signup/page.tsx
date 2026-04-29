"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createAccount } from "@/app/signup/actions";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType = params.get("type") === "startup" ? "startup" : "creator";

  const [userType, setUserType] = useState<"creator" | "startup">(initialType);
  const [name, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAccount({
        email,
        password,
        name,
        userType,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/membership");
      router.refresh();
    });
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center justify-center gap-3">
          <div className="bg-foreground flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
            <Image
              src="/images/glimpse-logo.png"
              alt="glimpse."
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="brand-wordmark text-2xl">glimpse.</span>
        </Link>

        <h1 className="mb-2 text-2xl font-medium">Create your account</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Choose your role to get the right onboarding.
        </p>

        <div className="border-border mb-6 grid grid-cols-2 gap-2 rounded-xl border p-1">
          <button
            type="button"
            onClick={() => setUserType("creator")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm transition-colors",
              userType === "creator"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Creator
          </button>
          <button
            type="button"
            onClick={() => setUserType("startup")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm transition-colors",
              userType === "startup"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Startup
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {userType === "creator" ? "Your name / stage name" : "Company name"}
            </Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={userType === "creator" ? "Kiri" : "Acme Inc."}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already on glimpse.?{" "}
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
