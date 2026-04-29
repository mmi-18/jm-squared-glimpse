/**
 * BetterAuth server-side instance + helpers.
 *
 * - Uses the Prisma adapter against our singleton Prisma client.
 * - Email + password only for now; email verification disabled (Mario's call).
 * - `additionalFields` extends BetterAuth's User model with the glimpse
 *   domain fields (userType, membershipTier, ...) so signup can store them
 *   directly on the User row instead of needing a parallel profile table.
 * - `nextCookies()` plugin lets server actions set/clear auth cookies (so
 *   signUp / signIn from a `"use server"` action work as expected).
 *
 * The matching client-side helpers live in `src/lib/auth-client.ts`.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
  },

  // Domain fields stored on the User row. BetterAuth surfaces them on the
  // session user object and lets signup pass them through.
  user: {
    additionalFields: {
      userType: {
        type: "string", // "creator" | "startup"
        required: true,
        input: true,
      },
      bio: { type: "string", required: false, input: true },
      locationCity: { type: "string", required: false, input: true },
      locationCountry: { type: "string", required: false, input: true },
      languages: { type: "string[]", required: false, input: true },
      culturalMarkets: { type: "string[]", required: false, input: true },
      onboardingCompleted: { type: "boolean", defaultValue: false, input: false },
      membershipTier: {
        type: "string", // "free" | "pro"
        defaultValue: "free",
        input: false,
      },
    },
  },

  session: {
    // 30 days. BetterAuth refreshes the session token in-place when it gets
    // close to expiry, so users stay logged in indefinitely while active.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24, // refresh token if older than 1 day
  },

  // MUST be the last plugin so it runs after all others. Lets server actions
  // attach Set-Cookie headers via Next's cookies() API.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

/**
 * Current authenticated user (full User row, BetterAuth core + domain
 * additionalFields) or null if signed out. Use in server components / server
 * actions / route handlers.
 *
 *   const user = await getCurrentUser();
 *   if (!user) redirect("/login");
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * Like getCurrentUser, but throws if signed out — call from places that
 * already enforce authentication (e.g. inside protected layouts that have
 * already redirected to /login when null).
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
