import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker/Hetzner deploy: bundles the server runtime into
  // .next/standalone so the production container only needs Node + a few
  // copied folders, not the full node_modules tree.
  output: "standalone",

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
