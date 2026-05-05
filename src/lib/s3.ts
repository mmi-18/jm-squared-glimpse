import { S3Client } from "@aws-sdk/client-s3";

/**
 * Hetzner Object Storage client (S3-compatible).
 *
 * Bucket lives in nbg1 — same datacenter as our CPX22, so traffic
 * between the container and the bucket is internal/free. Public-read
 * visibility is set on the bucket itself; objects are reachable via
 * `${HETZNER_S3_PUBLIC_URL}/<key>` without any authentication.
 *
 * Path-style addressing is the default for Hetzner — virtual-hosted
 * style isn't reliably supported across their LB so we set
 * `forcePathStyle: true` to keep the URL pattern stable.
 */

const requiredEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. See .env.example for the full set of S3 credentials.`,
    );
  }
  return v;
};

export const S3_BUCKET = requiredEnv("HETZNER_S3_BUCKET");
export const S3_PUBLIC_URL = requiredEnv("HETZNER_S3_PUBLIC_URL").replace(
  /\/+$/,
  "",
);

let _client: S3Client | null = null;

/**
 * Lazily-constructed S3 client. Lazy because env vars aren't always
 * present at module-eval time during `next build` (e.g. when the
 * builder collects page data and the runtime env hasn't been wired
 * yet). Constructing on first use avoids that footgun.
 */
export function s3(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: requiredEnv("HETZNER_S3_ENDPOINT"),
    region: requiredEnv("HETZNER_S3_REGION"),
    credentials: {
      accessKeyId: requiredEnv("HETZNER_S3_ACCESS_KEY"),
      secretAccessKey: requiredEnv("HETZNER_S3_SECRET_KEY"),
    },
    forcePathStyle: true,
  });
  return _client;
}

/** Convert an object key to a publicly-fetchable URL. */
export function publicUrlFor(key: string): string {
  // Trim any leading slash so the path-style URL doesn't double up.
  const cleanKey = key.replace(/^\/+/, "");
  return `${S3_PUBLIC_URL}/${cleanKey}`;
}
