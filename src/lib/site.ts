/**
 * Canonical site URL used for absolute URL generation in metadata,
 * sitemaps, robots.txt, and JSON-LD. Reads from `NEXT_PUBLIC_SITE_URL`
 * (set this in the deploy environment — Hetzner/Docker/GH Actions),
 * falling back to a localhost dev value.
 *
 * Always returns a URL without a trailing slash.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
