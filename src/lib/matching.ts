import type {
  CreatorProfile,
  IndustrySimilarity,
  Post,
  StartupProfile,
  StyleVector,
} from "@/lib/types";

const MAX_DISTANCE = Math.sqrt(7 * 81); // 7 dims, each max distance 9 → 25.456

function getStyleArray(v: StyleVector): number[] | null {
  const keys: (keyof StyleVector)[] = [
    "styleProductionValue",
    "stylePacing",
    "styleFocus",
    "styleFraming",
    "styleStaging",
    "styleColor",
    "styleSound",
  ];
  const arr = keys.map((k) => v[k]);
  if (arr.some((n) => n == null)) return null;
  return arr as number[];
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function jaccard(a?: string[] | null, b?: string[] | null): number {
  const A = new Set((a ?? []).map((s) => s.toLowerCase()));
  const B = new Set((b ?? []).map((s) => s.toLowerCase()));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function includesAny(a?: string[] | null, b?: string[] | null): boolean {
  if (!a || !b) return false;
  const B = new Set(b.map((s) => s.toLowerCase()));
  return a.some((x) => B.has(x.toLowerCase()));
}

export function industrySimilarity(
  creatorIndustries: string[] | null | undefined,
  startupIndustry: string | null | undefined,
  table: IndustrySimilarity[],
): number {
  if (!startupIndustry || !creatorIndustries || creatorIndustries.length === 0) {
    return 0;
  }
  const direct = creatorIndustries.some(
    (i) => i.toLowerCase() === startupIndustry.toLowerCase(),
  );
  if (direct) return 1.0;
  let best = 0;
  for (const ci of creatorIndustries) {
    for (const row of table) {
      if (
        row.industryA.toLowerCase() === ci.toLowerCase() &&
        row.industryB.toLowerCase() === startupIndustry.toLowerCase()
      ) {
        best = Math.max(best, row.similarityScore);
      }
    }
  }
  return best;
}

export type MatchBreakdown = {
  totalScore: number;
  styleScore: number;
  industryScore: number;
  skillScore: number;
  ventureScore: number;
  equipmentScore: number;
  personalScore: number;
  reputationScore: number;
  exceptional: boolean;
  hardFilterPassed: boolean;
};

function budgetOverlap(c: CreatorProfile, s: StartupProfile): boolean {
  const cmin = c.rateMin ?? 0;
  const cmax = c.rateMax ?? Number.POSITIVE_INFINITY;
  const smin = s.typicalBudgetRangeMin ?? 0;
  const smax = s.typicalBudgetRangeMax ?? Number.POSITIVE_INFINITY;
  return cmin <= smax && cmax >= smin;
}

function locationCompatible(
  c: CreatorProfile,
  s: StartupProfile,
  cUser: { culturalMarkets?: string[] | null },
  sUser: { culturalMarkets?: string[] | null },
): boolean {
  if (c.travelWillingness === "worldwide") return true;
  // Creator's cultural markets should overlap the startup's target markets
  const cMarkets = cUser.culturalMarkets ?? [];
  const sMarkets = (s.locationMarket ?? []).concat(sUser.culturalMarkets ?? []);
  if (cMarkets.length === 0 || sMarkets.length === 0) return true;
  return includesAny(cMarkets, sMarkets);
}

function languageMatch(
  cUser: { languages?: string[] | null },
  sUser: { languages?: string[] | null },
  s: StartupProfile,
): boolean {
  const cLangs = cUser.languages ?? [];
  const sLangs = (s.language ?? []).concat(sUser.languages ?? []);
  if (sLangs.length === 0) return true;
  return includesAny(cLangs, sLangs);
}

function disciplineMatch(c: CreatorProfile, s: StartupProfile): boolean {
  // If startup needs video deliverables, creator must do video (or both)
  const needs = s.deliverablesNeeded ?? [];
  const needsVideo = needs.some((d) =>
    ["short_social", "long_brand_film", "product_video", "event_coverage"].includes(d),
  );
  const needsPhoto = needs.some((d) => ["photo_series"].includes(d));
  if (needsVideo && c.discipline === "photo") return false;
  if (needsPhoto && c.discipline === "video") return false;
  return true;
}

function negativePreferenceFail(c: CreatorProfile, s: StartupProfile): boolean {
  const unwanted = (c.unwantedWorkTypes ?? []).map((x) => x.toLowerCase());
  if (unwanted.length === 0) return false;
  const goals = (s.projectGoal ?? []).map((x) => x.toLowerCase());
  const industry = s.industry?.toLowerCase();
  // If any unwanted tag matches the startup industry or goal, fail
  if (industry && unwanted.includes(industry)) return true;
  for (const g of goals) if (unwanted.includes(g)) return true;
  return false;
}

function personalFit(c: CreatorProfile, s: StartupProfile): number {
  const lookMatch = jaccard(c.contentStyleTags, s.desiredLookFeeling);
  const qualMatch = s.qualitiesInCreator?.length
    ? 1.0 // we don't have creator self-ratings, so assume average fit
    : 0.5;
  return 0.5 * lookMatch + 0.5 * qualMatch;
}

export type MatchInput = {
  creator: CreatorProfile;
  startup: StartupProfile;
  creatorUser: { languages?: string[] | null; culturalMarkets?: string[] | null };
  startupUser: { languages?: string[] | null; culturalMarkets?: string[] | null };
  industryTable: IndustrySimilarity[];
};

export function calculateMatchScore(input: MatchInput): MatchBreakdown | null {
  const { creator, startup, creatorUser, startupUser, industryTable } = input;

  const cStyle = getStyleArray(creator);
  const sStyle = getStyleArray(startup);

  // Compute style first — it's needed for the override rule
  const styleScore =
    cStyle && sStyle ? 1 - euclidean(cStyle, sStyle) / MAX_DISTANCE : 0;

  // Hard filters
  const budgetOk = budgetOverlap(creator, startup);
  const locOk = locationCompatible(creator, startup, creatorUser, startupUser);
  const langOk = languageMatch(creatorUser, startupUser, startup);
  const discOk = disciplineMatch(creator, startup);
  const negFail = negativePreferenceFail(creator, startup);

  const hardFilterPassed = budgetOk && locOk && langOk && discOk && !negFail;

  // Override rule: style > 0.9 bypasses partial hard-filter fails (but not negative preference)
  if (!hardFilterPassed) {
    if (!(styleScore > 0.9 && !negFail)) {
      return null;
    }
  }

  const industryScore = industrySimilarity(
    creator.industryExperience,
    startup.industry,
    industryTable,
  );

  const skillScore = jaccard(
    creator.deliverableTypes,
    startup.deliverablesNeeded,
  );

  const ventureScore = jaccard(
    creator.preferredProjectTypes,
    startup.projectGoal,
  );

  const equipmentScore =
    !startup.equipmentNeeded || startup.equipmentNeeded.length === 0
      ? 1.0
      : includesAny(creator.equipment, startup.equipmentNeeded)
        ? 1.0
        : 0.3;

  const personalScore = personalFit(creator, startup);

  const reputationScore = Number(creator.avgRating ?? 0) / 5.0;

  const totalScore =
    styleScore * 0.3 +
    industryScore * 0.2 +
    skillScore * 0.15 +
    ventureScore * 0.1 +
    equipmentScore * 0.05 +
    personalScore * 0.1 +
    reputationScore * 0.1;

  return {
    totalScore: Math.max(0, Math.min(1, totalScore)),
    styleScore,
    industryScore,
    skillScore,
    ventureScore,
    equipmentScore,
    personalScore,
    reputationScore,
    exceptional: styleScore > 0.9 && !hardFilterPassed,
    hardFilterPassed,
  };
}

// ---------------------------------------------------------------------------
// Post-level matching (used for feed ranking)
// ---------------------------------------------------------------------------

export function calculatePostMatchScore(
  post: Post,
  target: StyleVector & {
    industry?: string | null;
    deliverablesNeeded?: string[] | null;
    formatPreference?: string | null;
  },
  industryTable: IndustrySimilarity[],
): number {
  const postStyle = getStyleArray(post);
  const targetStyle = getStyleArray(target);

  const postStyleScore =
    postStyle && targetStyle
      ? 1 - euclidean(postStyle, targetStyle) / MAX_DISTANCE
      : 0.5;

  let industryMatch = 0.5;
  if (post.industry && target.industry) {
    if (post.industry.toLowerCase() === target.industry.toLowerCase()) {
      industryMatch = 1.0;
    } else {
      industryMatch = industrySimilarity(
        [post.industry],
        target.industry,
        industryTable,
      );
    }
  }

  const contentTypeMatch =
    target.deliverablesNeeded &&
    post.contentType &&
    target.deliverablesNeeded.includes(post.contentType)
      ? 1.0
      : 0.3;

  const formatMatch =
    !target.formatPreference || target.formatPreference === "both"
      ? 1.0
      : post.format === target.formatPreference
        ? 1.0
        : 0.5;

  return (
    postStyleScore * 0.4 +
    industryMatch * 0.3 +
    contentTypeMatch * 0.2 +
    formatMatch * 0.1
  );
}
