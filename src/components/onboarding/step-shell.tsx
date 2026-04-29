"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function StepShell({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  onSkip,
  nextLabel = "Next",
  nextDisabled = false,
  isImportant = false,
}: {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  isImportant?: boolean;
}) {
  const pct = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-foreground flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/images/glimpse-logo.png"
                alt="glimpse."
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="brand-wordmark text-lg">glimpse.</span>
          </Link>
          <div className="flex-1">
            <Progress value={pct} className="h-1.5" />
          </div>
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {isImportant && (
          <div className="mb-6 flex items-center justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">
              Optional — improves your matches
            </span>
            {onSkip && (
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip — set up later in profile →
              </Button>
            )}
          </div>
        )}
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        <div className="mt-8 space-y-6">{children}</div>

        <div
          className={cn(
            "mt-12 flex items-center",
            onBack ? "justify-between" : "justify-end",
          )}
        >
          {onBack && (
            <Button variant="ghost" type="button" onClick={onBack}>
              Back
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" onClick={onNext} disabled={nextDisabled}>
              {nextLabel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
