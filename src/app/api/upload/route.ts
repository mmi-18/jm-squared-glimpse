import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { S3_BUCKET, publicUrlFor, s3 } from "@/lib/s3";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 *
 * Multipart upload endpoint. Streams the body straight to Hetzner
 * Object Storage (NBG1 bucket — same datacenter as this server, free
 * internal traffic). Returns the public URL the browser can fetch
 * directly without going back through this server.
 *
 * Limits:
 *   - max 10 MB per file
 *   - jpg / png / webp / gif / mp4 / quicktime only
 *
 * Auth: sign-in required.
 *
 * Notes vs the previous filesystem-backed version:
 *   - No more bind-mount on the host — bucket is the source of truth.
 *   - URLs returned are absolute (https://...) so they survive any
 *     change of glimpse domain or backend host.
 *   - public-read bucket visibility means the returned URL is
 *     directly hot-linkable from `<img>` / `<video>` / etc. — no
 *     server roundtrip per fetch.
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

  const key = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await s3().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      // Long cache: filenames are uuids, content is immutable per URL.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return NextResponse.json({
    url: publicUrlFor(key),
    contentType: file.type,
    size: file.size,
  });
}
