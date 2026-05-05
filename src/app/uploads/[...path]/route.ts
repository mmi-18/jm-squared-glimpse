import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /uploads/<...path>
 *
 * Serves files from the bind-mounted `/app/uploads` directory (which
 * is the host's `/home/mario/glimpse/uploads/`). Used because Next.js's
 * production static-file handler builds a manifest of public/ at image
 * build time — files added at runtime via volume mount return 404 from
 * the static handler. This route handler reads from disk on every
 * request, so volume-mounted files Just Work.
 *
 * Defensive against path traversal: rejects any segment containing
 * `..`, `/`, `\`, or a leading `.`. Final resolved path must stay
 * under UPLOADS_DIR.
 *
 * Cache: long max-age + immutable, since filenames are uuids — content
 * never changes for a given URL.
 */

// Mime detection from file extension. Kept in sync with the allow-list
// in /api/upload (route.ts). New mimes there → mirror here.
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await context.params;
  if (!parts || parts.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Sanitize each path segment.
  for (const seg of parts) {
    if (
      !seg ||
      seg === "." ||
      seg === ".." ||
      seg.includes("/") ||
      seg.includes("\\") ||
      seg.startsWith(".")
    ) {
      return new NextResponse("Bad request", { status: 400 });
    }
  }

  const target = path.resolve(path.join(UPLOADS_DIR, ...parts));
  // Belt-and-suspenders: must still be under UPLOADS_DIR after resolve.
  if (!target.startsWith(UPLOADS_DIR + path.sep) && target !== UPLOADS_DIR) {
    return new NextResponse("Bad request", { status: 400 });
  }

  let stats;
  try {
    stats = await stat(target);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!stats.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(target).slice(1).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  const data = await readFile(target);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      // Filenames are uuids, content never changes. Cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
