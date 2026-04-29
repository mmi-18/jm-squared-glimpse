"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";

export type SignupResult = { ok: true } | { ok: false; error: string };

/**
 * Creates a new user via BetterAuth's email-password flow and signs them in.
 *
 * - `name` maps to BetterAuth's required user field (formerly `name`).
 * - `userType` is one of our extended `additionalFields` on the User model.
 * - Email verification is disabled (see `auth.ts`), so the user lands signed
 *   in immediately. The `nextCookies()` plugin sets the session cookie via
 *   Next.js's cookies() API so the very next page load sees the session.
 *
 * Surface a friendly "already exists" message; otherwise let BetterAuth's
 * own message through.
 */
export async function createAccount(args: {
  email: string;
  password: string;
  name: string;
  userType: "creator" | "startup";
}): Promise<SignupResult> {
  try {
    await auth.api.signUpEmail({
      body: {
        email: args.email,
        password: args.password,
        name: args.name,
        userType: args.userType,
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof APIError) {
      const msg = err.message || "Failed to create account";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return { ok: false, error: "An account with this email already exists." };
      }
      return { ok: false, error: msg };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create account",
    };
  }
}
