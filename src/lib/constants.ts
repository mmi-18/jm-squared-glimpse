export const CONTENT_CATEGORIES = [
  { value: "outdoor_adventure", label: "Outdoor & Adventure" },
  { value: "tech_product", label: "Tech & Product" },
  { value: "food_lifestyle", label: "Food & Lifestyle" },
  { value: "corporate", label: "Corporate" },
  { value: "event", label: "Event" },
  { value: "music", label: "Music" },
  { value: "real_estate", label: "Real Estate" },
  { value: "luxury_lifestyle", label: "Luxury Lifestyle" },
  { value: "maritime", label: "Maritime" },
  { value: "automotive", label: "Automotive" },
  { value: "music_events", label: "Music & Events" },
  { value: "nature_landscape", label: "Nature & Landscape" },
  { value: "travel", label: "Travel" },
  { value: "fashion", label: "Fashion" },
];

export const CONTENT_STYLE_TAGS = [
  "cinematic",
  "raw",
  "moody",
  "bright",
  "documentary",
  "fast-paced",
  "polished",
  "editorial",
  "atmospheric",
  "energetic",
  "nostalgic",
  "minimalist",
  "warm",
  "vibrant",
];

export const DELIVERABLE_TYPES = [
  { value: "short_social", label: "Short Social Clip" },
  { value: "long_brand_film", label: "Long Brand Film" },
  { value: "product_video", label: "Product Video" },
  { value: "event_coverage", label: "Event Coverage" },
  { value: "photo_series", label: "Photo Series" },
];

export const AVAILABILITY = [
  { value: "immediately", label: "Immediately" },
  { value: "within_1_week", label: "Within 1 week" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "limited", label: "Limited" },
];

export const TURNAROUND = [
  { value: "1_3_days", label: "1–3 days" },
  { value: "1_week", label: "1 week" },
  { value: "2_weeks", label: "2 weeks" },
  { value: "1_month", label: "1 month" },
  { value: "flexible", label: "Flexible" },
];

export const TRAVEL = [
  { value: "local_only", label: "Local only" },
  { value: "regional", label: "Regional" },
  { value: "national", label: "National" },
  { value: "international", label: "International" },
  { value: "worldwide", label: "Worldwide" },
];

export const LICENSING = [
  { value: "full_buyout", label: "Full buyout" },
  { value: "limited_usage", label: "Limited usage" },
  { value: "negotiable", label: "Negotiable" },
];

export const SUB_SPECIALIZATIONS = [
  "drone_cinematography",
  "color_grading",
  "sound_design",
  "motion_graphics",
  "lifestyle_photography",
  "event_photography",
  "landscape_photography",
];

export const INDUSTRY_EXPERIENCE = [
  "tech_saas",
  "outdoor_sport",
  "food_bev",
  "automotive",
  "fashion",
  "luxury_lifestyle",
  "music_entertainment",
  "travel_adventure",
  "sustainability",
  "real_estate",
  "lifestyle",
  "manufacturing",
  "fintech",
  "health",
  "education",
];

export const INDUSTRIES = INDUSTRY_EXPERIENCE;

export const PRODUCTION_CAPABILITIES = [
  "solo_production",
  "team_lead",
  "post_production",
  "color_grading",
  "sound_mixing",
];

export const PROJECT_GOALS = [
  { value: "brand_awareness", label: "Brand awareness" },
  { value: "product_launch", label: "Product launch" },
  { value: "social_growth", label: "Social growth" },
  { value: "website_content", label: "Website content" },
  { value: "recruiting", label: "Recruiting" },
];

export const DESIRED_LOOK = [
  "premium",
  "authentic",
  "playful",
  "corporate",
  "edgy",
  "warm",
  "cinematic",
  "bold",
  "immersive",
  "grounded",
];

export const CONTENT_PLATFORMS = [
  "website",
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "paid_ads",
];

export const TARGET_AUDIENCE = [
  "gen_z",
  "millennials",
  "b2b_decision_makers",
  "families",
  "tech_enthusiasts",
  "outdoor_enthusiasts",
  "motorcycle_enthusiasts",
  "investors",
];

export const QUALITIES = [
  "reliability",
  "creativity",
  "speed",
  "communication",
  "brand_understanding",
];

export const COMPANY_STAGES = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b_plus", label: "Series B+" },
  { value: "established", label: "Established" },
];

export const BRAND_GUIDELINES = [
  { value: "strict_brand_guide", label: "Strict brand guide" },
  { value: "loose_guidelines", label: "Loose guidelines" },
  { value: "no_guidelines", label: "No guidelines" },
  { value: "open_to_suggestions", label: "Open to suggestions" },
];

export const USAGE_RIGHTS = [
  { value: "full_buyout", label: "Full buyout" },
  { value: "limited_platform", label: "Limited platform" },
  { value: "time_limited", label: "Time limited" },
  { value: "negotiable", label: "Negotiable" },
];

export const LANGUAGES = [
  "English",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Portuguese",
  "Swedish",
  "Norwegian",
  "Danish",
  "Dutch",
];

export const CULTURAL_MARKETS = ["DACH", "EU", "US", "Nordics", "UK", "Global"];

export const STYLE_DIMENSIONS = [
  {
    key: "styleProductionValue",
    label: "Production value",
    low: "Raw / BTS",
    high: "High-end / polished",
  },
  {
    key: "stylePacing",
    label: "Pacing",
    low: "Calm / contemplative",
    high: "Dynamic / fast-cut",
  },
  {
    key: "styleFocus",
    label: "Focus",
    low: "People / emotion",
    high: "Product / technical",
  },
  {
    key: "styleFraming",
    label: "Framing",
    low: "Intimate / close",
    high: "Wide / epic",
  },
  {
    key: "styleStaging",
    label: "Staging",
    low: "Documentary / observational",
    high: "Scripted / directed",
  },
  {
    key: "styleColor",
    label: "Color",
    low: "Natural / muted",
    high: "Stylized / high-contrast",
  },
  {
    key: "styleSound",
    label: "Sound",
    low: "Ambient / field",
    high: "Music-driven",
  },
] as const;

export type StyleDimensionKey = (typeof STYLE_DIMENSIONS)[number]["key"];
