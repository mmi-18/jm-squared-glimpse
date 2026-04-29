"use client";

import { useState, useTransition } from "react";
import { StepShell } from "@/components/onboarding/step-shell";
import { StyleSlider } from "@/components/onboarding/style-slider";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { CalendarDays } from "lucide-react";
import {
  CONTENT_CATEGORIES,
  DELIVERABLE_TYPES,
  TURNAROUND,
  TRAVEL,
  LICENSING,
  SUB_SPECIALIZATIONS,
  INDUSTRY_EXPERIENCE,
  PRODUCTION_CAPABILITIES,
  LANGUAGES,
  CULTURAL_MARKETS,
  STYLE_DIMENSIONS,
} from "@/lib/constants";
import { saveCreatorOnboarding } from "@/app/onboarding/actions";

const TOTAL_STEPS = 6;

function toArr(v: number | readonly number[] | undefined): number[] {
  if (Array.isArray(v)) return [...v];
  if (typeof v === "number") return [v];
  return [];
}

type State = {
  name: string;
  locationCity: string;
  locationCountry: string;
  languages: string[];
  culturalMarkets: string[];
  creativeDiscipline:
    | "videographer"
    | "photographer"
    | "both"
    | "motion_designer";
  discipline: "video" | "photo" | "both";
  contentCategories: string[];
  styleProductionValue: number;
  stylePacing: number;
  styleFocus: number;
  styleFraming: number;
  styleStaging: number;
  styleColor: number;
  styleSound: number;
  deliverableTypes: string[];
  rateMin: number;
  rateMax: number;
  minimumAcceptableBudget: number;
  travelWillingness: string;
  typicalTurnaround: string;
  subSpecializations: string[];
  industryExperience: string[];
  productionCapabilities: string[];
  preferredProjectTypes: string[];
  unwantedWorkTypes: string[];
  usageLicensingPreference: string;
  creativePhilosophy: string;
};

const INITIAL: State = {
  name: "",
  locationCity: "",
  locationCountry: "",
  languages: [],
  culturalMarkets: [],
  creativeDiscipline: "both",
  discipline: "both",
  contentCategories: [],
  styleProductionValue: 5,
  stylePacing: 5,
  styleFocus: 5,
  styleFraming: 5,
  styleStaging: 5,
  styleColor: 5,
  styleSound: 5,
  deliverableTypes: [],
  rateMin: 400,
  rateMax: 1000,
  minimumAcceptableBudget: 300,
  travelWillingness: "international",
  typicalTurnaround: "1_week",
  subSpecializations: [],
  industryExperience: [],
  productionCapabilities: [],
  preferredProjectTypes: [],
  unwantedWorkTypes: [],
  usageLicensingPreference: "negotiable",
  creativePhilosophy: "",
};

export default function CreatorOnboarding() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<State>(INITIAL);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function finish() {
    setError(null);
    startTransition(async () => {
      try {
        const {
          name,
          locationCity,
          locationCountry,
          languages,
          culturalMarkets,
          ...profile
        } = state;
        await saveCreatorOnboarding({
          name,
          locationCity,
          locationCountry,
          languages,
          culturalMarkets,
          // State holds plain strings for enum fields (Discipline, Turnaround,
          // Travel, Licensing, ...) — they're picked from the same option
          // values the DB enum uses, so the cast is safe at this boundary.
          profile: profile as unknown as Parameters<
            typeof saveCreatorOnboarding
          >[0]["profile"],
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const step1Valid =
    state.name.trim() &&
    state.locationCity.trim() &&
    state.languages.length > 0;
  const step2Valid = state.contentCategories.length > 0;
  const step4Valid = state.deliverableTypes.length > 0;

  return (
    <>
      {step === 0 && (
        <StepShell
          stepIndex={0}
          totalSteps={TOTAL_STEPS}
          title="Who you are"
          subtitle="The basics. Where you're based and what languages you work in."
          onNext={next}
          nextDisabled={!step1Valid}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name or stage name</Label>
            <Input
              id="name"
              value={state.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Kiri"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={state.locationCity}
                onChange={(e) => set("locationCity", e.target.value)}
                placeholder="Munich"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={state.locationCountry}
                onChange={(e) => set("locationCountry", e.target.value)}
                placeholder="Germany"
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label>Languages you work in</Label>
            <ChipGroup
              options={LANGUAGES}
              value={state.languages}
              onChange={(v) => set("languages", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Cultural markets you serve</Label>
            <ChipGroup
              options={CULTURAL_MARKETS}
              value={state.culturalMarkets}
              onChange={(v) => set("culturalMarkets", v)}
            />
          </div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          stepIndex={1}
          totalSteps={TOTAL_STEPS}
          title="What you do"
          subtitle="Pick your discipline and the categories you cover."
          onBack={back}
          onNext={next}
          nextDisabled={!step2Valid}
        >
          <div className="space-y-3">
            <Label>Creative discipline</Label>
            <ChipGroup
              options={[
                { value: "videographer", label: "Videographer" },
                { value: "photographer", label: "Photographer" },
                { value: "both", label: "Both" },
                { value: "motion_designer", label: "Motion designer" },
              ]}
              value={[state.creativeDiscipline]}
              onChange={(v) => {
                const val = (v[0] ?? "both") as State["creativeDiscipline"];
                set("creativeDiscipline", val);
                set(
                  "discipline",
                  val === "photographer"
                    ? "photo"
                    : val === "videographer"
                      ? "video"
                      : "both",
                );
              }}
              allowMultiple={false}
            />
          </div>
          <div className="space-y-3">
            <Label>Content categories</Label>
            <ChipGroup
              options={CONTENT_CATEGORIES}
              value={state.contentCategories}
              onChange={(v) => set("contentCategories", v)}
            />
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          stepIndex={2}
          totalSteps={TOTAL_STEPS}
          title="Your style"
          subtitle="Seven dimensions that define how your work looks and feels. Move each slider to show where your work sits."
          onBack={back}
          onNext={next}
        >
          <div className="space-y-4">
            {STYLE_DIMENSIONS.map((dim) => (
              <StyleSlider
                key={dim.key}
                label={dim.label}
                low={dim.low}
                high={dim.high}
                value={state[dim.key]}
                onChange={(v) => set(dim.key, v)}
              />
            ))}
          </div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell
          stepIndex={3}
          totalSteps={TOTAL_STEPS}
          title="Your work"
          subtitle="What you deliver, what you charge, and how you work."
          onBack={back}
          onNext={next}
          nextDisabled={!step4Valid}
        >
          <div className="space-y-3">
            <Label>Deliverable types you offer</Label>
            <ChipGroup
              options={DELIVERABLE_TYPES}
              value={state.deliverableTypes}
              onChange={(v) => set("deliverableTypes", v)}
            />
          </div>

          <div className="border-border bg-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Daily rate range (EUR)</span>
              <span className="text-muted-foreground text-sm">
                €{state.rateMin} – €{state.rateMax}
              </span>
            </div>
            <Slider
              min={100}
              max={3000}
              step={50}
              value={[state.rateMin, state.rateMax]}
              onValueChange={(v) => {
                const arr = toArr(v);
                if (arr.length === 2) {
                  set("rateMin", Math.min(arr[0], arr[1]));
                  set("rateMax", Math.max(arr[0], arr[1]));
                }
              }}
            />
          </div>

          <div className="border-border bg-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Minimum acceptable budget</span>
              <span className="text-muted-foreground text-sm">
                €{state.minimumAcceptableBudget}
              </span>
            </div>
            <Slider
              min={0}
              max={5000}
              step={100}
              value={[state.minimumAcceptableBudget]}
              onValueChange={(v) =>
                set("minimumAcceptableBudget", toArr(v)[0] ?? 300)
              }
            />
          </div>

          <div className="space-y-3">
            <Label>Travel willingness</Label>
            <ChipGroup
              options={TRAVEL}
              value={[state.travelWillingness]}
              onChange={(v) =>
                set("travelWillingness", v[0] ?? "international")
              }
              allowMultiple={false}
            />
          </div>

          <div className="space-y-3">
            <Label>Typical turnaround</Label>
            <ChipGroup
              options={TURNAROUND}
              value={[state.typicalTurnaround]}
              onChange={(v) => set("typicalTurnaround", v[0] ?? "1_week")}
              allowMultiple={false}
            />
          </div>

          <div className="bg-warm flex items-start gap-3 rounded-xl p-4 text-sm">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-muted-foreground">
              You&apos;ll set your availability from the calendar on your
              profile — block dates manually or sync with Google, Outlook, or
              Apple Calendar.
            </p>
          </div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell
          stepIndex={4}
          totalSteps={TOTAL_STEPS}
          title="Go deeper"
          subtitle="Sub-specializations, industry experience, and production capabilities."
          onBack={back}
          onNext={next}
          onSkip={next}
          isImportant
        >
          <div className="space-y-3">
            <Label>Sub-specializations</Label>
            <ChipGroup
              options={SUB_SPECIALIZATIONS}
              value={state.subSpecializations}
              onChange={(v) => set("subSpecializations", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Industry experience</Label>
            <ChipGroup
              options={INDUSTRY_EXPERIENCE}
              value={state.industryExperience}
              onChange={(v) => set("industryExperience", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Production capabilities</Label>
            <ChipGroup
              options={PRODUCTION_CAPABILITIES}
              value={state.productionCapabilities}
              onChange={(v) => set("productionCapabilities", v)}
            />
          </div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell
          stepIndex={5}
          totalSteps={TOTAL_STEPS}
          title="Preferences"
          subtitle="What do you want more of — and what do you never want to shoot again?"
          onBack={back}
          onNext={finish}
          onSkip={finish}
          isImportant
          nextLabel={pending ? "Saving…" : "Finish"}
          nextDisabled={pending}
        >
          <div className="space-y-3">
            <Label>Preferred project types</Label>
            <ChipGroup
              options={[
                "brand_content",
                "editorial",
                "event_coverage",
                "expedition_documentation",
                "lifestyle_documentation",
                "product_launch",
                "travel_editorial",
              ]}
              value={state.preferredProjectTypes}
              onChange={(v) => set("preferredProjectTypes", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Work types you do not want</Label>
            <p className="text-muted-foreground -mt-1 text-sm">
              We use this as a hard filter — you won&apos;t see matches against
              these types.
            </p>
            <ChipGroup
              options={[
                "corporate_talking_head",
                "stock_photography",
                "corporate_events",
                "product_photography",
                "real_estate",
                "food_photography",
                "fast_turnaround",
              ]}
              value={state.unwantedWorkTypes}
              onChange={(v) => set("unwantedWorkTypes", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Licensing preference</Label>
            <ChipGroup
              options={LICENSING}
              value={[state.usageLicensingPreference]}
              onChange={(v) =>
                set("usageLicensingPreference", v[0] ?? "negotiable")
              }
              allowMultiple={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="philosophy">Creative philosophy</Label>
            <Textarea
              id="philosophy"
              rows={4}
              value={state.creativePhilosophy}
              onChange={(e) => set("creativePhilosophy", e.target.value)}
              placeholder="In a few lines: how you think about your work."
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </StepShell>
      )}
    </>
  );
}
