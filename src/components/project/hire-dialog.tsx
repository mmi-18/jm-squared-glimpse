"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
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
  hireCreator,
  type AgreementInput,
} from "@/app/(app)/project/agreement-actions";

/**
 * "Hire <creator>" entry point. Opens a modal with the structured
 * work-agreement form. Submitting creates a Project in `pending`
 * with the client's acceptance pre-set, then redirects to the
 * project page so the creator can review + accept (visible on their
 * inbox / project list).
 *
 * Visibility rules are enforced by the parent — only render this
 * for startups viewing creator profiles.
 */
export function HireDialog({
  creatorId,
  creatorName,
  isAuthenticated,
  trigger,
}: {
  creatorId: string;
  creatorName: string;
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
    const res = await hireCreator({ creatorId, agreement: input });
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
            <Briefcase className="size-4" /> Hire {creatorName.split(" ")[0]}
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hire {creatorName}</DialogTitle>
            <DialogDescription>
              Set the terms. {creatorName.split(" ")[0]} reviews these
              and either accepts or counters before any work starts.
              You can edit before they accept; once both sides accept,
              the project goes active.
            </DialogDescription>
          </DialogHeader>

          <WorkAgreementForm
            submitLabel={`Send offer to ${creatorName.split(" ")[0]}`}
            pendingLabel="Sending offer…"
            helperHint="Submitting this counts as your acceptance of these terms."
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
