"use client";

/**
 * Client-side helper for the /api/upload endpoint. Wraps the multipart
 * POST + JSON response handling so callers don't think about it.
 *
 *   const { url } = await uploadFile(fileFromInput);
 *   <img src={url} />
 *
 * Throws Error with a friendly message on non-2xx response. The caller
 * handles cancellation / progress UI; this helper is intentionally
 * minimal so it stays usable from anywhere (post-editor, message
 * composer, profile avatar picker, etc.).
 */

export type UploadResult = {
  url: string;
  contentType: string;
  size: number;
};

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const resp = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    let message = `Upload failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — keep the generic message
    }
    throw new Error(message);
  }

  return resp.json();
}
