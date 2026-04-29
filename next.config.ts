import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: we do NOT use `output: "standalone"`. The Dockerfile ships the
  // full node_modules so the Prisma CLI (which has a deep dep tree —
  // `effect` etc. via @prisma/config) works at container start for
  // `prisma migrate deploy`.

  images: {
    // Allow remote SVGs from the avatar service we use during onboarding.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Identicons during onboarding before the user uploads an avatar.
      { protocol: "https", hostname: "api.dicebear.com" },
      // QR-code generator used on the share-profile screen.
      { protocol: "https", hostname: "api.qrserver.com" },
    ],
  },
};

export default nextConfig;
