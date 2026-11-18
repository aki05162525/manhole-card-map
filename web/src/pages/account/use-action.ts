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
  // A refresh behind what is shown: the controls stay usable.
  background?: boolean;
};

// The busy flag and the error line shared by a screen's actions.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    action: () => Promise<void>,
    { prompt = false, handle, settled, background = false }: Options = {},
  ) => {
    setError("");
    if (!background) setBusy(true);
    try {
      await action();
    } catch (failure) {
      // Not this screen's any more (left, or another user's now): no error.
      if (failure instanceof Dropped) return;
      if (handle?.(failure) || (prompt && cancelled(failure))) return;
      setError(message(failure));
    } finally {
      if (!background) setBusy(false);
      settled?.();
    }
  };
  return { busy, error, setError, run };
}

// The forms are noValidate, so the browser's own bubble never shows: an
// empty field is reported in the page's wording, with focus back on it.
/** The text typed into the form's field `name`. */
export function fieldText(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}
export function emptyField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement;
  if (field.value.trim()) return false;
  field.focus();
  return true;
}
