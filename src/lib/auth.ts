/**
 * BetterAuth server-side instance.
 *
 * - Uses the Prisma adapter against our singleton Prisma client.
 * - Email + password only for now; email verification disabled (Mario's call).
 * - `additionalFields` extends BetterAuth's User model with the glimpse
 *   domain fields (userType, membershipTier, ...) so signup can store them
 *   directly on the User row instead of needing a parallel profile table.
 *
 * The matching client-side helpers live in `src/lib/auth-client.ts`.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
