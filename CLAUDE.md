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

## Commercial model

Platform fees on each completed project (current as of May 2026):

- **Companies (startups) pay 10%** on top of the project face value
- **Creators pay 5%** out of the project face value

So a €5,000 project means: client pays €5,500 → creator receives €4,750 →
platform takes €750 (~13.6% of cash flow). Total platform take stays
roughly in line with Upwork (~15%) but with the **larger share carried
by the buyer**, who is generally less price-sensitive than the creator
selling their time.

Reasoning recorded so we don't drift later:
- Creator-side fee kept low (5%) so glimpse beats Fiverr (20%) and
  Upwork (10%) on creator take-home — important for creator acquisition
- Client-side fee (10%) frames glimpse as a curated marketplace, not a
  bidding race-to-the-bottom; clients accept the surcharge in exchange
  for the project-management + audit-trail + escrow features
- Repeat clients can be discounted later (e.g., 8% on the 3rd+ project
  with the same creator) as a retention lever — see Chunk F notes

These rates are **business-policy constants**. When implementing
payment flows, reference this section, do not hard-code different
numbers in code without checking here first.

## Backlog of ideas

Design notes Mario wants to come back to but isn't building today
live in `docs/IDEAS.md`. Look there before starting any non-trivial
new feature — it's the place we record "remember this for later"
so we don't keep re-discovering ideas.

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
- **Object storage**: Hetzner Object Storage (S3-compatible) in NBG1 — same
  datacenter as the server, internal traffic free. Bucket
  `jm-squared-glimpse-uploads`, public-read visibility. See
  `src/lib/s3.ts` for the configured client; `src/app/api/upload/route.ts`
  is the entry point. Object Lock is **off** (we need to honor GDPR
  delete-on-request, which Object Lock would prevent).

## Work agreement (Chunk C)

The "Hire" flow on a creator profile is the production entry point for
projects. It opens a structured agreement form and creates a `Project`
in `pending` status. Both parties have to accept before status flips to
`active` and the existing project state machine (Chunk A) takes over.

Schema fields (all on `Project`, all nullable so legacy / dev rows
created before Chunk C keep working):

- `scope`, `deliverables` — free-text. Creator + client both read this
  before accepting; treat it as the legal handshake basis.
- `priceCents` (Int) + `currency` (default "EUR") — face value in
  minor units (Stripe/Adyen/Mollie idiom). Platform fees (10% client /
  5% creator, see "Commercial model" above) apply on top of this.
- `deadline` (`@db.Date`) — calendar deadline, time component irrelevant.
- `revisionRounds` (Int) — bundled into the price; further rounds need
  an amendment.
- `usageRights` (UsageRights enum, reused from StartupProfile) — full
  buyout / limited platform / time-limited / negotiable.
- `clientAcceptedAt` + `creatorAcceptedAt` (timestamptz) — set when
  each party accepts. Both non-null + status=pending ⇒ status flips
  to active in the same `acceptAgreement` transaction.

State rules (enforced in `src/app/(app)/project/agreement-actions.ts`):

- `hireCreator`: only startups; creates Project with terms + the
  client's acceptance pre-set (submitting the form *is* the offer).
- `amendAgreement`: either party can amend while pending. The amender's
  acceptance is set; the **counterparty's acceptance is cleared** — they
  must re-accept the new terms.
- `acceptAgreement`: caller's `*AcceptedAt` is set; if the other side
  is already accepted, the same update flips status `pending → active`.
- All three actions reject when status ≠ pending. Once a project is
  active, the agreement is immutable for the rest of the project.

UI surfaces:

- **Hire** button on `/creator/<id>` (logged-out + startups). Opens
  `src/components/project/hire-dialog.tsx`. Sets `clientAcceptedAt`
  on submit.
- **Pitch** button on `/startup/<id>` (logged-out + creators) —
  the symmetric counterpart. Opens `src/components/project/pitch-dialog.tsx`
  and calls `proposeProject` instead of `hireCreator`. Sets
  `creatorAcceptedAt` on submit. Same form, same Project record,
  same agreement panel — just the other entry door.
- `src/components/project/agreement-panel.tsx` renders on
  `/project/<id>` while status=pending — shows the terms grid + each
  party's acceptance pill + accept/amend buttons. Direction-agnostic.
- **`/projects` workspace** — top-level tab in both navs. Lists all
  projects the viewer is on, sectioned by:
  1. *Needs your attention* (counterparty accepted but you haven't,
     or you're the client and creator just delivered) — amber banner.
  2. *In progress* (active + delivered with no action owed)
  3. *Negotiating* (pending, waiting on counterparty)
  4. *Completed*
  5. *Cancelled* (collapsed/dimmed)
  See `src/lib/projects.ts` for `countNeedsAttention(userId)` (used
  by the nav badge — fires from `<AppShell>` on every authed request)
  and `listProjectsForUser(userId)` (used by the page).
- `/dev/project/new` is still around as a dev shortcut that skips the
  agreement and spawns straight into `active` — handy for exercising
  the mark-delivered/sign-off flow without the handshake.

## Deliveries (Chunk E)

Creators hand finished work to clients via the **delivery** mechanism
on `/project/<id>`. Status `active` → creator sees an inline upload
panel (`<DeliverySubmitForm>`); they pick one or more files (each
uploads to the bucket the moment it's selected) plus an optional
note, and click "Submit delivery" — which:

1. Persists a new `Delivery` row with the file manifest (Json) +
   note
2. Flips project status `active → delivered`

Both happen in a single transaction so partial state is impossible.

The Delivery model is 1:N from Project on purpose, even though v1
only ever creates one Delivery per project. The shape is ready for
revision rounds (Chunk G) — submit-revisions will create an
additional Delivery row and bounce status back to `active`.

File manifest shape on `Delivery.files` (JSONB):

```ts
{ name: string; url: string; sizeBytes: number; contentType: string; }[]
```

We persist the original filename so clients download
`final-cut.mp4`, not the uuid the bucket key uses.

Upload route (`/api/upload`) limits as of Chunk E:

- 50 MB per file (covers most exported videos; bigger raws need to
  be shared via external link in the delivery message)
- mimes: image/* (jpg/png/webp/gif), video/* (mp4/mov/webm/mkv),
  audio/* (mp3/wav/aac/flac), application/pdf, application/zip

Bucket policy: today deliveries land in the same public-read bucket
as posts/messages. URLs are uuid-keyed (high entropy, not
enumerable), and the application enforces who sees them — the
delivery panel only renders when the viewer is a project party. For
production-grade privacy (sensitive client material), the upgrade
path is a separate private bucket + signed URLs minted per request;
the schema is already ready for it (only `s3.ts` changes).

The legacy one-click "Mark as delivered" button is gone. The
`markDelivered` server action still exists as a shim that calls
`submitDelivery` with empty files + a placeholder message — used by
older tests / dev tools, not the UI.

## Money flow (Chunk F-prep)

The full state machine now passes through a deposit gate. Both
parties accept the agreement, then the **client** has to deposit
before status flips `pending → active`.

```
pending  ↶  drafting / accepting / amending
   ↓
pending  ↶  both-accepted, awaiting deposit  ← Deposit €X CTA
   ↓
active   ↶  deposit landed, work happening
   ↓
delivered ↶ creator submitted, awaiting sign-off
   ↓
completed ↶ client signed off; payoutScheduledFor = signedOffAt + 24h
   ↓                                           (24h undo window)
completed ↶ payoutReleasedAt set by daily cron after that window
```

**Critically: this is mock money.** The "Deposit" button is
implemented by `markProjectPaid` in `agreement-actions.ts`, which
just stamps `paidAt = now()`. No Stripe involved. The "Payout
released" timestamp is similarly set by the cron without any actual
transfer. The intent is to ship the workflow and UX *now*, then
bolt real Stripe Checkout in front of `markProjectPaid` and a real
`stripe.transfers.create()` into the cron in **Chunk F-stripe**
later — when Mario has Stripe keys + a registered company entity.

Schema fields on `Project` (all on the same row, all nullable):

- `paidAt` — set when the client confirms the deposit
- `stripeCheckoutSessionId` — null today; populated by F-stripe
- `payoutScheduledFor` — `signedOffAt + 24h`; cleared on `undoSignOff`
- `payoutReleasedAt` — set by the daily cron when the schedule fires

Cron: `POST /api/cron/release-stale-reviews` (kept the original
URL for backward compat with the GH Actions workflow). Runs three
jobs in one pass — review release, 14-day auto-acceptance of stuck
deliveries, and payout release.

Cancellation: clears `paidAt` + `payoutScheduledFor` (mock refund).
Edge case worth noting: cancelling AFTER delivery means the creator
did the work but won't be paid. Arbitration / partial refunds are
deferred to a future chunk.

Pricing display reads from the agreed `priceCents` × the published
fees (10% client / 5% creator, see "Commercial model" above) — see
`PaymentStatusCard` for the rendering. When you change the fee
percentages, grep for `* 1.1` and `* 0.95` and update both.

## Uploads

User uploads (post images, future delivery files, avatars) all flow
through `src/app/api/upload/route.ts`:

```
browser → POST /api/upload (multipart)
       → requireUser() (signed-in only)
       → s3().send(PutObjectCommand)
       → Hetzner Object Storage (nbg1)
       ← { url: https://nbg1.your-objectstorage.com/<bucket>/<key>, ... }
```

The returned URL is hot-linkable (public-read bucket) — no signed URLs
needed for posts. When we eventually add private deliveries (Chunk B-2
messaging attachments / Chunk C work-agreement files), use a separate
private bucket + signed URLs.

Path-style URLs only (`forcePathStyle: true` in s3.ts). Hetzner's
load balancer doesn't reliably support virtual-hosted style.

Filesystem-upload mode (the original Chunk B that landed before
the bucket existed) is gone — no more `/home/mario/glimpse/uploads/`
bind mount, no more `src/app/uploads/[...path]/route.ts`. If a
deploy ever needs to roll back to filesystem mode, both git history
and the prior route handler can be restored.

## Don't read runtime env at module top-level

`next build` traces every page's imports during page-data collection.
Anything at module top-level that touches `process.env` for a runtime
secret (DB credentials, S3 keys, BetterAuth secret, etc.) **runs in
the build environment** — which doesn't have those vars set. The build
crashes with `Missing env var X`, deploy gets skipped.

We hit this exact bug on the S3 cutover (run #25386972294 Build job
failed; see commit `c3e0433` for the fix).

**Bad** — throws at `next build`:

```ts
// src/lib/s3.ts
export const S3_BUCKET = requireEnv("HETZNER_S3_BUCKET");  // ❌
```

**Good** — only fires when called inside a request:

```ts
export function s3Bucket(): string {
  return requireEnv("HETZNER_S3_BUCKET");  // ✓
}
```

Rule of thumb: anything that reads a runtime env var goes inside a
function, not at top level. Build-time vars baked into the client
bundle (`NEXT_PUBLIC_*` set as Docker `ARG`) are the exception —
those are valid at build because they're passed into the build.

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

### Migrating Supabase → Neon (the pattern, in case we do this again)

`scripts/migrate-from-supabase.ts` is the worked example for glimpse —
ran once on 2026-04-29 to bring 22 users + 12 creator profiles + 6
startup profiles + 18 posts + 1 message thread + 6 reviews from the old
Supabase project (`kyvfiihydffryedrftcs`) onto Neon. Idempotent via
upsert. Safe to re-run.

Recipe for a future Supabase-backed project:

1. **Inventory the source.** Use the Supabase MCP — `list_tables` for
   row counts + `pg_total_relation_size` for total bytes. The MCP's
   `execute_sql` truncates around 30 KB, so don't try to dump big
   tables through it.
2. **Pull the Supabase service key** from the old project's `.env`
   (`SUPABASE_SECRET_KEY`). Plus the project URL.
3. **Add a migration script** that uses `@supabase/supabase-js` (admin
   client with the service key) to fetch and Prisma to write. Mirror
   the existing `migrate-from-supabase.ts` shape: one `fetchAll<T>`
   helper, one upsert loop per table, snake_case → camelCase mapping
   inline, UUIDs preserved as primary keys.
4. **For BetterAuth password migration** — Supabase's bcrypt hashes
   are NOT compatible with BetterAuth's scrypt. Either (a) set every
   user to a single shared password (cheap, dev-only), or (b) skip
   passwords and have users reset on first login. We did (a) for
   glimpse:
   - Import `hashPassword` from `better-auth/crypto`
   - Hash the shared password ONCE, reuse for all Account rows
   - Each User gets one `Account { providerId: "credential",
     accountId: <email>, password: <hash> }` row
5. **One enum quirk to watch for.** Prisma enum names can't start
   with a digit. Schemas like `enum Turnaround { days_1_3 @map("1_3_days"), … }`
   mean the DB stores `"1_3_days"` but the Prisma client API expects
   `"days_1_3"`. The migration script needs to translate the DB form
   → TS form for those specific enum values. Grep schema for `@map`
   to find them.
6. **Run, verify row counts match, sign in.** Then smoke-test the
   live app via `curl /api/auth/sign-in/email`.

Don't commit `SUPABASE_SERVICE_KEY` — it's in `.env`, gitignored.

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
