# Backlog: ideas to come back to

A durable home for "remember this for later" notes — design ideas,
features, second-order observations — that we don't want to lose
between sessions but don't want to act on yet.

When acting on one, move it from here into a Chunk plan in CLAUDE.md
or just delete it and write the implementation.

---

## Creator team-ups (Mario, 2026-05-05)

Creators should be able to **connect and team up** with other creators,
either ones they already know or ones surfaced by the matching
algorithm. Then when a startup needs a multi-discipline crew —
e.g. 2 photographers + 1 editor + 1 music producer + 1 colour grader —
glimpse suggests **whole pre-formed teams**, not just individual
creators.

Why this matters:

- Real productions are almost always multi-person. A single creator
  rarely covers shoot + edit + grade + sound at quality.
- Today's matching surfaces individuals against briefs. Teams are
  invisible.
- Creators self-organising into informal collectives is already how
  the freelance video world operates — glimpse can either ignore that
  pattern or formalise it as a feature.

Open design questions (not for now — list them so we don't have to
re-derive when we pick this up):

1. **Ownership / billing**: when a team gets hired, is the contract
   one-to-many (one client, multiple creators, each with their own
   pay split) or one-to-one (team has a "lead" who subcontracts)?
   The first is fairer, the second is simpler legally. Most likely
   answer: lead-creator model first, expand to per-member splits
   later when we have payment infra mature enough.
2. **Team formation**: invites between creators? Open team listings
   ("looking for a colourist for our team")? Algorithmic team
   suggestions based on style + complementary skills?
3. **How matching changes**: a brief now matches against (creator |
   team). The matching pipeline needs an extra entity. Style scores
   would aggregate (mean? min? weighted by role?). This is non-
   trivial and could be the single biggest matching-algorithm
   investment of 2026 H2.
4. **Team profile pages**: `/team/<id>` mirrors `/creator/<id>` but
   with N members + a "we are" pitch. Reviews accumulate to the
   team, not just individuals.
5. **Project state machine**: today the Project model has exactly
   two parties (`clientId`, `creatorId`). Multi-party projects need
   a `ProjectMember` join table — at minimum.

When we pick this up, expect it to be a multi-chunk effort touching
schema, matching, profile pages, and the project state machine.
Probably 2-4 weeks of work. Not before payments + deliveries are
solid.
