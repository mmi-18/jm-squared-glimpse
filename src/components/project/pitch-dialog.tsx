"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkAgreementForm } from "@/components/project/work-agreement-form";
import {
  proposeProject,
  type AgreementInput,
} from "@/app/(app)/project/agreement-actions";

/**
 * "Pitch <company>" entry point — the creator-side mirror of
 * <HireDialog>. Same agreement form (scope / deliverables / price /
 * deadline / revisions / usage rights), different pre-acceptance:
 * submitting counts as the creator's acceptance, and the startup
 * sees a pending agreement on /project/<id> with their "your turn"
 * acceptance card.
 *
 * Visible only to logged-in creators (and logged-out users → /login)
 * viewing a startup profile. The parent enforces these rules.
 */
export function PitchDialog({
  startupId,
  startupName,
  isAuthenticated,
  trigger,
}: {
  startupId: string;
  startupName: string;
  isAuthenticated: boolean;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onTriggerClick() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  async function handleSubmit(input: AgreementInput) {
    const res = await proposeProject({ startupId, agreement: input });
    if (res.ok) {
      setOpen(false);
      router.push(`/project/${res.projectId}`);
      router.refresh();
    }
    return res;
  }

  return (
    <>
      <span onClick={onTriggerClick} className="inline-flex cursor-pointer">
        {trigger ?? (
          <Button>
            <Send className="size-4" /> Pitch {startupName.split(" ")[0]}
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pitch {startupName}</DialogTitle>
            <DialogDescription>
              Set the terms you&apos;re offering. {startupName.split(" ")[0]}{" "}
              reviews these and either accepts or counters before any work
              starts. You can edit the offer until they accept; once both
              sides accept, the project goes active.
            </DialogDescription>
          </DialogHeader>

          <WorkAgreementForm
            submitLabel={`Send pitch to ${startupName.split(" ")[0]}`}
            pendingLabel="Sending pitch…"
            helperHint="Submitting this counts as your acceptance of these terms."
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
