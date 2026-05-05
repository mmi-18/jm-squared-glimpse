"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelProject } from "@/app/(app)/project/actions";

/**
 * Slim "Cancel project" affordance used while status=pending. The
 * full ProjectActions bar isn't rendered in pending state because
 * it's geared toward the active/delivered/completed transitions —
 * but the user still needs an out if a negotiation goes nowhere.
 */
export function PendingCancelRow({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelProject(projectId);
        setConfirm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="mt-3 flex items-center justify-end">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setConfirm(true)}
        disabled={pending}
      >
        <X className="h-3.5 w-3.5" /> Cancel project
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this project?</DialogTitle>
            <DialogDescription>
              Walking away from the negotiation. Both parties will be
              notified. This can&apos;t be undone — to start over you&apos;d
              need to send a new offer.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirm(false)}
              disabled={pending}
            >
              Keep talking
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
