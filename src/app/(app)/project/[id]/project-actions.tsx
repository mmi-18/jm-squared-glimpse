"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelProject,
  signOffProject,
  undoSignOff,
} from "@/app/(app)/project/actions";

type Role = "client" | "creator";
type Status = "pending" | "active" | "delivered" | "completed" | "cancelled";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Per-role action bar for a project. Renders the buttons appropriate
 * to the current role + status combination, plus confirmation dialogs
 * for the destructive / consequential transitions (sign-off, cancel).
 *
 *  status      | client sees                       | creator sees
 *  ------------+-----------------------------------+--------------------
 *  pending     | Cancel                            | Cancel
 *  active      | Cancel                            | (DeliverySubmitForm
 *               |                                   |  handles the flip)
 *  delivered   | Mark complete & sign off + Cancel | (waiting message)
 *  completed   | Undo sign-off (within 24h)        | (read-only)
 *  cancelled   | (no actions; component not       | (no actions; component not
 *               rendered by the page)             | rendered by the page)
 *
 * Chunk E note: the old creator+active "Mark as delivered" button is
 * gone — that role+status combo is now handled by the upload form
 * (DeliverySubmitForm), which atomically creates a Delivery row +
 * flips status when the creator submits.
 */
export function ProjectActions({
  projectId,
  role,
  status,
  signedOffAt,
}: {
  projectId: string;
  role: Role;
  status: Status;
  /** ISO string of when the project was signed off, or null. */
  signedOffAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmSignOff, setConfirmSignOff] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  // Client-side check; the server action re-verifies before mutating.
  const within24h = signedOffAt
    ? Date.now() - new Date(signedOffAt).getTime() <= UNDO_WINDOW_MS
    : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {role === "client" && status === "delivered" && (
          <Button
            onClick={() => setConfirmSignOff(true)}
            disabled={pending}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark complete & sign off
          </Button>
        )}

        {role === "client" && status === "completed" && within24h && (
          <Button
            variant="outline"
            onClick={() => run(() => undoSignOff(projectId))}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            Undo sign-off (within 24h)
          </Button>
        )}

        {(status === "pending" ||
          status === "active" ||
          status === "delivered") && (
          <Button
            variant="ghost"
            onClick={() => setConfirmCancel(true)}
            disabled={pending}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4" /> Cancel project
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Sign-off confirmation */}
      <Dialog open={confirmSignOff} onOpenChange={setConfirmSignOff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign off on this project?</DialogTitle>
            <DialogDescription>
              You&apos;re marking this project complete. You&apos;ll have
              a 24-hour window to undo if you change your mind. After
              that, the sign-off is final and payment will be released
              to the creator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmSignOff(false)}
              disabled={pending}
            >
              Not yet
            </Button>
            <Button
              onClick={() => {
                setConfirmSignOff(false);
                run(() => signOffProject(projectId));
              }}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this project?</DialogTitle>
            <DialogDescription>
              Both parties will be notified. This can&apos;t be undone —
              to keep working together you&apos;d need to start a new
              project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmCancel(false)}
              disabled={pending}
            >
              Keep project
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmCancel(false);
                run(() => cancelProject(projectId));
              }}
              disabled={pending}
            >
              Cancel project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
