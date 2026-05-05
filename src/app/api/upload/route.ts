import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 *
 * Multipart upload endpoint. Stores files on the server's filesystem
 * under public/uploads/ — which is the volume target the host binds at
 * /home/mario/glimpse/uploads. Returns a stable URL that can be used as
 * an `<img>` / `<video>` src.
 *
 * Why filesystem (not S3/R2): Mario's call (cost-conscious MVP, no
 * external bucket vendor). Hetzner Object Storage / Cloudflare R2 is
 * a swap-in later when storage scales past comfortable disk sizes.
 *
 * Limits:
 *   - max 10 MB per file (raised in env later if needed)
 *   - jpg / png / webp / gif / mp4 / quicktime only
 *
 * Auth: sign-in required. Anonymous uploads are not allowed.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not parse upload" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file (form field name should be 'file')" },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (got ${(file.size / 1024 / 1024).toFixed(
          1,
        )} MB, max ${MAX_BYTES / 1024 / 1024} MB)`,
      },
      { status: 413 },
    );
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      {
        error: `File type not allowed (got ${file.type}). Allowed: ${Object.keys(
          ALLOWED,
        ).join(", ")}`,
      },
      { status: 415 },
    );
  }

  // randomUUID produces 36-char hex with dashes — collision risk on
  // 10^36 namespace is microscopic, no need for nanoid here.
  const filename = `${randomUUID()}.${ext}`;
  // /app/uploads — bind-mounted from host's /home/mario/glimpse/uploads.
  // Served back to the browser via src/app/uploads/[...path]/route.ts.
  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const target = path.join(uploadsDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(target, buffer);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    contentType: file.type,
    size: file.size,
  });
}
