"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clearBrief, saveBrief } from "@/app/(app)/brief/actions";

type Initial = {
  title: string;
  description: string;
  referenceUrls: string[];
};

export function BriefComposer({ initial }: { initial: Initial | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [refs, setRefs] = useState<string[]>(
    initial?.referenceUrls?.length ? initial.referenceUrls : [],
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(f);
          }),
      ),
    ).then((urls) => setRefs((r) => [...r, ...urls]));
    e.target.value = "";
  }

  function removeRef(i: number) {
    setRefs((r) => r.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await saveBrief({ title, description, referenceUrls: refs });
      setSaved(true);
      router.refresh();
    });
  }

  function onClear() {
    startTransition(async () => {
      await clearBrief();
      setTitle("");
      setDescription("");
      setRefs([]);
      router.refresh();
    });
  }

  const hasActive = initial !== null;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. R 1300 GS Alpine launch shoot"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          What kind of creator are you looking for?
        </Label>
        <Textarea
          id="description"
          required
          rows={7}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the project, the feel you want, the creator background that would fit, deliverables, timeline, and anything else that matters."
        />
        <p className="text-muted-foreground text-xs">
          We parse this to find creators whose industry experience, content
          categories, and style signature align.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Reference images</Label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {refs.map((src, i) => (
            <div
              key={i}
              className="border-border bg-muted relative aspect-square overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Reference ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeRef(i)}
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove reference"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label
            className={cn(
              "border-border bg-muted/30 hover:bg-muted flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed transition-colors",
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={onFilePick}
            />
            <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
              <Plus className="h-5 w-5" />
              <span>Add image</span>
            </div>
          </label>
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Upload className="h-3 w-3" /> Drop multiple images to build a
          moodboard.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          {hasActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={pending}
              className="text-muted-foreground"
            >
              Clear active brief
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-muted-foreground text-xs">
              Saved — feed updated.
            </span>
          )}
          <Button type="submit" disabled={pending || !title || !description}>
            {pending ? "Saving…" : hasActive ? "Update brief" : "Save brief"}
          </Button>
        </div>
      </div>
    </form>
  );
}
