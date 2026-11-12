import { useState } from "react";
import { Dropped } from "../../features/account/account-api";
import { cancelled } from "../../features/account/webauthn";
import { message } from "./messages";

type Options = {
  // The action opens a passkey prompt: dismissing it goes back without an
  // error. Without a prompt the same exception is a failed request.
  prompt?: boolean;
  // Returns true for a failure it has dealt with.
  handle?(failure: unknown): boolean;
  // Runs together with the end of busy, whatever the outcome.
  settled?(): void;
};

// The busy flag and the error line shared by a screen's actions.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    action: () => Promise<void>,
    { prompt = false, handle, settled }: Options = {},
  ) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      // Not this screen's any more (left, or another user's now): no error.
      if (failure instanceof Dropped) return;
      if (handle?.(failure) || (prompt && cancelled(failure))) return;
      setError(message(failure));
    } finally {
      setBusy(false);
      settled?.();
    }
  };
  return { busy, error, setError, run };
}
