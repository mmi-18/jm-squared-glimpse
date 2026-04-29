"use client";

import { useState, useTransition } from "react";
import { StepShell } from "@/components/onboarding/step-shell";
import { StyleSlider } from "@/components/onboarding/style-slider";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  INDUSTRIES,
  CULTURAL_MARKETS,
  LANGUAGES,
  PROJECT_GOALS,
  DESIRED_LOOK,
  DELIVERABLE_TYPES,
  CONTENT_PLATFORMS,
  TARGET_AUDIENCE,
  QUALITIES,
  COMPANY_STAGES,
  BRAND_GUIDELINES,
  USAGE_RIGHTS,
  STYLE_DIMENSIONS,
} from "@/lib/constants";
import { saveStartupOnboarding } from "@/app/onboarding/actions";

const TOTAL_STEPS = 7;

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
  companyName: string;
  industry: string;
  locationMarket: string[];
  contactPerson: string;
  contactRole: string;
  projectGoal: string[];
  desiredLookFeeling: string[];
  deliverablesNeeded: string[];
  quantityVolume: number;
  styleProductionValue: number;
  stylePacing: number;
  styleFocus: number;
  styleFraming: number;
  styleStaging: number;
  styleColor: number;
  styleSound: number;
  typicalBudgetRangeMin: number;
  typicalBudgetRangeMax: number;
  budgetForProject: number;
  contentUsagePlatforms: string[];
  companyStage: string;
  websiteUrl: string;
  companyDescription: string;
  brandLookGuidelines: string;
  targetAudience: string[];
  language: string[];
  successCriteria: string;
  qualitiesInCreator: string[];
  usageRightsScope: string;
  brandDescription: string;
};

const INITIAL: State = {
  name: "",
  locationCity: "",
  locationCountry: "",
  languages: [],
  culturalMarkets: [],
  companyName: "",
  industry: "",
  locationMarket: [],
  contactPerson: "",
  contactRole: "",
  projectGoal: [],
  desiredLookFeeling: [],
  deliverablesNeeded: [],
  quantityVolume: 1,
  styleProductionValue: 5,
  stylePacing: 5,
  styleFocus: 5,
  styleFraming: 5,
  styleStaging: 5,
  styleColor: 5,
  styleSound: 5,
  typicalBudgetRangeMin: 500,
  typicalBudgetRangeMax: 2500,
  budgetForProject: 2000,
  contentUsagePlatforms: [],
  companyStage: "seed",
  websiteUrl: "",
  companyDescription: "",
  brandLookGuidelines: "loose_guidelines",
  targetAudience: [],
  language: [],
  successCriteria: "",
  qualitiesInCreator: [],
  usageRightsScope: "negotiable",
  brandDescription: "",
};

export default function StartupOnboarding() {
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
        await saveStartupOnboarding({
          name: state.companyName || name,
          locationCity,
          locationCountry,
          languages,
          culturalMarkets,
          // State holds plain strings for enum fields (CompanyStage,
          // BrandGuidelines, UsageRights, ...) — chip-group values match
          // the DB enum verbatim so the cast is safe at this boundary.
          profile: profile as unknown as Parameters<
            typeof saveStartupOnboarding
          >[0]["profile"],
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const step1Valid =
    state.companyName.trim() &&
    state.industry.trim() &&
    state.contactPerson.trim();
  const step2Valid =
    state.projectGoal.length > 0 && state.deliverablesNeeded.length > 0;

  return (
    <>
      {step === 0 && (
        <StepShell
          stepIndex={0}
          totalSteps={TOTAL_STEPS}
          title="Your company"
          subtitle="Who you are and where you work."
          onNext={next}
          nextDisabled={!step1Valid}
        >
          <div className="space-y-2">
            <Label htmlFor="company">Company name</Label>
            <Input
              id="company"
              value={state.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="e.g. Heimplanet"
            />
          </div>
          <div className="space-y-3">
            <Label>Primary industry</Label>
            <ChipGroup
              options={INDUSTRIES}
              value={state.industry ? [state.industry] : []}
              onChange={(v) => set("industry", v[0] ?? "")}
              allowMultiple={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={state.locationCity}
                onChange={(e) => set("locationCity", e.target.value)}
                placeholder="Hamburg"
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
            <Label>Markets you operate in</Label>
            <ChipGroup
              options={CULTURAL_MARKETS}
              value={state.locationMarket}
              onChange={(v) => set("locationMarket", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact">Contact person</Label>
              <Input
                id="contact"
                value={state.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
                placeholder="Clara Vogt"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={state.contactRole}
                onChange={(e) => set("contactRole", e.target.value)}
                placeholder="Brand Manager"
              />
            </div>
          </div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          stepIndex={1}
          totalSteps={TOTAL_STEPS}
          title="Your project goal"
          subtitle="What are you trying to achieve, and what does success look like?"
          onBack={back}
          onNext={next}
          nextDisabled={!step2Valid}
        >
          <div className="space-y-3">
            <Label>Project goals</Label>
            <ChipGroup
              options={PROJECT_GOALS}
              value={state.projectGoal}
              onChange={(v) => set("projectGoal", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Desired look &amp; feeling</Label>
            <ChipGroup
              options={DESIRED_LOOK}
              value={state.desiredLookFeeling}
              onChange={(v) => set("desiredLookFeeling", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Deliverables needed</Label>
            <ChipGroup
              options={DELIVERABLE_TYPES}
              value={state.deliverablesNeeded}
              onChange={(v) => set("deliverablesNeeded", v)}
            />
          </div>
          <div className="border-border bg-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Quantity / volume</span>
              <span className="text-muted-foreground text-sm">
                {state.quantityVolume} piece{state.quantityVolume === 1 ? "" : "s"}
              </span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={[state.quantityVolume]}
              onValueChange={(v) => set("quantityVolume", toArr(v)[0] ?? 1)}
            />
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          stepIndex={2}
          totalSteps={TOTAL_STEPS}
          title="What kind of content are you looking for?"
          subtitle="Set the seven style dimensions to describe the content you want."
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
          title="Budget & timeline"
          subtitle="Your typical budgets and where the content will live."
          onBack={back}
          onNext={next}
        >
          <div className="border-border bg-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Typical budget range (EUR)</span>
              <span className="text-muted-foreground text-sm">
                €{state.typicalBudgetRangeMin} – €
                {state.typicalBudgetRangeMax}
              </span>
            </div>
            <Slider
              min={200}
              max={20000}
              step={100}
              value={[
                state.typicalBudgetRangeMin,
                state.typicalBudgetRangeMax,
              ]}
              onValueChange={(v) => {
                const arr = toArr(v);
                if (arr.length === 2) {
                  set("typicalBudgetRangeMin", Math.min(arr[0], arr[1]));
                  set("typicalBudgetRangeMax", Math.max(arr[0], arr[1]));
                }
              }}
            />
          </div>
          <div className="border-border bg-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Budget for this project</span>
              <span className="text-muted-foreground text-sm">
                €{state.budgetForProject}
              </span>
            </div>
            <Slider
              min={200}
              max={20000}
              step={100}
              value={[state.budgetForProject]}
              onValueChange={(v) => set("budgetForProject", toArr(v)[0] ?? 2000)}
            />
          </div>
          <div className="space-y-3">
            <Label>Where will the content be used?</Label>
            <ChipGroup
              options={CONTENT_PLATFORMS}
              value={state.contentUsagePlatforms}
              onChange={(v) => set("contentUsagePlatforms", v)}
            />
          </div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell
          stepIndex={4}
          totalSteps={TOTAL_STEPS}
          title="Your brand"
          subtitle="A short description helps creators understand what you stand for."
          onBack={back}
          onNext={next}
          onSkip={next}
          isImportant
        >
          <div className="space-y-3">
            <Label>Company stage</Label>
            <ChipGroup
              options={COMPANY_STAGES}
              value={[state.companyStage]}
              onChange={(v) => set("companyStage", v[0] ?? "seed")}
              allowMultiple={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website URL</Label>
            <Input
              id="website"
              value={state.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Company description</Label>
            <Textarea
              id="description"
              rows={4}
              value={state.companyDescription}
              onChange={(e) => set("companyDescription", e.target.value)}
              placeholder="A few sentences on what your company does and stands for."
            />
          </div>
          <div className="space-y-3">
            <Label>Brand look guidelines</Label>
            <ChipGroup
              options={BRAND_GUIDELINES}
              value={[state.brandLookGuidelines]}
              onChange={(v) =>
                set("brandLookGuidelines", v[0] ?? "loose_guidelines")
              }
              allowMultiple={false}
            />
          </div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell
          stepIndex={5}
          totalSteps={TOTAL_STEPS}
          title="Your audience"
          subtitle="Who are you making this content for?"
          onBack={back}
          onNext={next}
          onSkip={next}
          isImportant
        >
          <div className="space-y-3">
            <Label>Target audience</Label>
            <ChipGroup
              options={TARGET_AUDIENCE}
              value={state.targetAudience}
              onChange={(v) => set("targetAudience", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Content language</Label>
            <ChipGroup
              options={LANGUAGES}
              value={state.language}
              onChange={(v) => set("language", v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="success">How do you measure success?</Label>
            <Textarea
              id="success"
              rows={3}
              value={state.successCriteria}
              onChange={(e) => set("successCriteria", e.target.value)}
              placeholder="e.g. social reach, engagement, brand recall."
            />
          </div>
        </StepShell>
      )}

      {step === 6 && (
        <StepShell
          stepIndex={6}
          totalSteps={TOTAL_STEPS}
          title="Creator requirements"
          subtitle="What qualities matter most, and what rights do you need?"
          onBack={back}
          onNext={finish}
          onSkip={finish}
          isImportant
          nextLabel={pending ? "Saving…" : "Finish"}
          nextDisabled={pending}
        >
          <div className="space-y-3">
            <Label>Qualities you look for in a creator</Label>
            <ChipGroup
              options={QUALITIES}
              value={state.qualitiesInCreator}
              onChange={(v) => set("qualitiesInCreator", v)}
            />
          </div>
          <div className="space-y-3">
            <Label>Usage rights scope</Label>
            <ChipGroup
              options={USAGE_RIGHTS}
              value={[state.usageRightsScope]}
              onChange={(v) => set("usageRightsScope", v[0] ?? "negotiable")}
              allowMultiple={false}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </StepShell>
      )}
    </>
  );
}
