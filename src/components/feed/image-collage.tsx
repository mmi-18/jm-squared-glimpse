import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Top-left dominant collage (1 large + up to 3 smaller stacked on the right).
 * Gracefully handles 1–4+ images.
 */
export function ImageCollage({
  images,
  alt,
  className,
  aspect = "3/2",
}: {
  images: string[];
  alt: string;
  className?: string;
  aspect?: string;
}) {
  const imgs = images.filter(Boolean);

  if (imgs.length === 0) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center rounded-xl",
          className,
        )}
        style={{ aspectRatio: aspect }}
      >
        no media
      </div>
    );
  }

  if (imgs.length === 1) {
    return (
      <div
        className={cn("relative overflow-hidden rounded-xl", className)}
        style={{ aspectRatio: aspect }}
      >
        <Image src={imgs[0]} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div
        className={cn(
          "relative grid grid-cols-2 gap-1 overflow-hidden rounded-xl",
          className,
        )}
        style={{ aspectRatio: aspect }}
      >
        {imgs.slice(0, 2).map((src, i) => (
          <div key={i} className="relative">
            <Image src={src} alt={`${alt} ${i + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, 16vw" />
          </div>
        ))}
      </div>
    );
  }

  // 3 or 4: 60/40 layout — 1 large + 2–3 small
  const side = imgs.slice(1, 4);
  return (
    <div
      className={cn(
        "grid grid-cols-5 gap-1 overflow-hidden rounded-xl",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      <div className="relative col-span-3">
        <Image src={imgs[0]} alt={`${alt} main`} fill className="object-cover" sizes="(max-width: 768px) 60vw, 20vw" />
      </div>
      <div className="col-span-2 grid grid-rows-[repeat(auto-fit,minmax(0,1fr))] gap-1">
        {side.map((src, i) => (
          <div key={i} className="relative">
            <Image src={src} alt={`${alt} ${i + 2}`} fill className="object-cover" sizes="(max-width: 768px) 40vw, 13vw" />
          </div>
        ))}
      </div>
    </div>
  );
}
