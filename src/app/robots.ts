import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * Allow Google + everyone else to index public pages (creator + startup
 * profiles, posts, the marketing landing). Block authenticated/private
 * surfaces and dev-only routes.
 */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/creator/", "/startup/", "/post/", "/feed"],
        disallow: [
          "/inbox",
          "/inbox/",
          "/onboarding",
          "/onboarding/",
          "/membership",
          "/new-post",
          "/brief",
          "/project",
          "/project/",
          "/dev",
          "/dev/",
          "/api",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
