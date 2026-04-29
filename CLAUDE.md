@AGENTS.md

# Working style for this project

## Think like a UI/UX designer

Before writing code for anything user-facing, reason about the interaction from the user's perspective. That means:

- **Affordance first.** Is it obvious what the user can click, drag, or resize? If not, fix the affordance (size, contrast, label) before adding more features.
- **Defaults matter more than options.** The default state should work for 95% of users. Power-user controls collapse into "Details" / "Customize" panels.
- **Reduce the ask.** Strip every form field and setting that isn't essential. Inherit from existing state (creator profile, post context) before asking the user to fill it in.
- **Constraints are design.** The cell-spanning grid has exactly four spans (1×1, 2×1, 1×2, 2×2) for a reason — more options would not make it a better tool. Respect the system when extending it.
- **Mobile-first, laptop-more-of-it.** Smartphone is the primary surface; desktop is the same layout with more columns, not a new one. Never add hover-only interactions. Respect `env(safe-area-inset-*)`.
- **Show, don't tell.** For any non-obvious change, produce a before/after comparison (layout sketch, screenshot, cells JSON diff) before writing code.
- **Name things for users, not for engineers.** Section headings and button labels read in the user's voice ("Customize layout", not "Toggle edit mode").
- **Live preview wherever reasonable.** If the user is building something (post, brief, preview tile), the result should update as they type / drag / pick — no "click to preview" dead states.

When in doubt, ask the question "how would Trade Republic / Pinterest / Instagram handle this?" and apply that pattern with glimpse.'s visual language.

## Stack reference

This project is **self-hosted on Hetzner** behind Traefik — never on Vercel,
never on Netlify, never on Cloudflare Pages.

- **Server**: Hetzner CPX22 (Ubuntu 24.04) at `91.99.239.81`, user `mario`
- **Reverse proxy**: Traefik v3.6 with Let's Encrypt → `glimpse.jm-squared.com`
- **DB**: Neon Postgres 17 (project `jm-squared`, region `eu-central-1`)
- **ORM**: Prisma v6 (NOT v7 — keep the traditional `datasource` block in
  `schema.prisma`; do not introduce `prisma.config.ts`)
- **Auth**: BetterAuth (email + password), self-hosted via the Prisma adapter
- **Container**: Docker on the server only — Mario does not run Docker locally
- **Image registry**: GitHub Container Registry (`ghcr.io/mmi-18/...`)
- **CI/CD**: GitHub Actions (build → push to ghcr → SSH-pull on Hetzner)

## Prisma migrations

Use the standard Prisma flow against the Neon `main` branch:

```bash
# After editing prisma/schema.prisma:
npm run prisma:migrate         # creates + applies a new migration in dev
# In CI / on the server:
npm run prisma:deploy          # applies pending migrations, no schema diff
```

`schema.prisma` is the source of truth. Generated SQL lives in
`prisma/migrations/` — commit those alongside the schema change so CI can
replay them deterministically.

The Neon project has two connection strings; `.env` carries both:
- `DATABASE_URL` — pooled (`-pooler` host) for runtime queries
- `DIRECT_URL` — direct (no pooler) for `prisma migrate` DDL

If you need a destructive operation (`prisma migrate reset`, etc.), Prisma's
AI-agent guard will refuse without explicit user consent — ask Mario, get a
yes, then re-run with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=<his exact
yes message>`.

## Auth (BetterAuth)

- Server-side: `import { auth, getCurrentUser, requireUser } from "@/lib/auth"`
- Client-side: `import { signIn, signUp, signOut, useSession } from "@/lib/auth-client"`
- The `User` table is **merged**: BetterAuth core fields (id, email,
  emailVerified, name, image, createdAt, updatedAt) live alongside glimpse
  domain fields (userType, membershipTier, locationCity, ...) via
  `additionalFields` in `auth.ts`. There is no separate "users" table — the
  Supabase-era split is gone.
- Email verification is disabled. Sign-up auto-signs the user in.

## Deploys: Hetzner via GitHub Actions

The app deploys via the GitHub Actions workflow at
`.github/workflows/deploy.yml` (built in Phase 1C). The flow is:

1. Push to `main` →
2. GH Actions builds the Docker image →
3. Pushes to `ghcr.io/mmi-18/jm-squared-glimpse:latest` →
4. SSHes into the Hetzner box and `docker compose pull && docker compose up -d`

> **Never `git push origin main` without explicit final permission from
> Mario.** Pushing to main triggers an automatic Docker build + production
> deploy to `glimpse.jm-squared.com`. That's a user-facing change.
> `git add` + `git commit` are fine without asking; `git push` is not.
> When work is committed and ready, **stop, summarize, and ask** before
> pushing. This rule overrides any "go finish the task" framing earlier in
> the session.

**Env vars (on the Hetzner host, in `.env` next to `docker-compose.yml`):**
- `DATABASE_URL` — pooled Neon connection string
- `DIRECT_URL` — direct Neon connection string (Prisma Migrate)
- `BETTER_AUTH_SECRET` — 32-byte base64 (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` — `https://glimpse.jm-squared.com`
- `NEXT_PUBLIC_SITE_URL` — same as BETTER_AUTH_URL

`NEXT_PUBLIC_*` vars are baked into the client bundle at build time, so they
must also be set as **GitHub Actions secrets** (the build runs in CI, not on
the server).

**File uploads** live on the Hetzner filesystem under
`/srv/glimpse/uploads/`, mounted into the container at `/app/uploads`. Cheap,
no S3 bill, persists across container restarts (Docker named volume). When
moving off-box later, swap to Hetzner Object Storage — same s3-compat API.
