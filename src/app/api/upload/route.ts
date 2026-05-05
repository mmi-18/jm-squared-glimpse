import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { publicUrlFor, s3, s3Bucket } from "@/lib/s3";

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
 *   - max 50 MB per file (raised from 10 MB in Chunk E so creators
 *     can deliver export-quality video; bigger raws still need an
 *     external link, dropped in the delivery message)
 *   - allowed mimes cover post media + delivery formats: image,
 *     video, audio, pdf, zip
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
 *
 * Future: 50 MB+ deliveries would need browser-direct presigned-URL
 * uploads (so the bytes don't pass through this Next.js server, which
 * runs on a 4 GB Hetzner box). When that lands, this route becomes a
 * thin "give me a presigned PUT URL" endpoint instead of a proxy.
 */

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED: Record<string, string> = {
  // Images
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Video
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  // Audio (music producers, voice-overs)
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  // Documents (briefs, storyboards, signed contracts)
  "application/pdf": "pdf",
  // Archives (project files: .prproj/.fcpx/.drp inside .zip)
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
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
      Bucket: s3Bucket(),
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
