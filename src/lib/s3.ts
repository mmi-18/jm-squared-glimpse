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
 *
 * IMPORTANT: every export here is lazy. `next build` traces imports
 * during page-data collection, and the build environment doesn't have
 * the HETZNER_S3_* env vars set (those live in the runtime .env). If
 * we read env at module-eval time, the build crashes. So all access
 * goes through a function call that's only invoked at request time.
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

let _client: S3Client | null = null;

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

/** The bucket name we PUT/GET/DELETE against. Read at call time. */
export function s3Bucket(): string {
  return requiredEnv("HETZNER_S3_BUCKET");
}

/** Convert an object key to a publicly-fetchable URL. */
export function publicUrlFor(key: string): string {
  const base = requiredEnv("HETZNER_S3_PUBLIC_URL").replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `${base}/${cleanKey}`;
}
