import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/feed",
  showIcon = true,
  size = "md",
  className,
}: {
  href?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const textSize =
    size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-base";
  const iconPx = size === "lg" ? 56 : size === "md" ? 44 : 32;

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-3", className)}
    >
      {showIcon && (
        <div
          className="bg-foreground relative flex items-center justify-center overflow-hidden rounded-2xl"
          style={{ width: iconPx, height: iconPx }}
        >
          <Image
            src="/images/glimpse-logo.png"
            alt="glimpse."
            width={iconPx}
            height={iconPx}
            className="h-full w-full object-cover"
            priority
          />
        </div>
      )}
      <span
        className={cn(
          "brand-wordmark text-foreground leading-none",
          textSize,
        )}
      >
        glimpse.
      </span>
    </Link>
  );
}
