import { useEffect, useId, useRef, type ReactNode } from "react";

// A modal <dialog>; Esc and the back gesture close it like "やめる".
export function ConfirmDialog({
  open,
  title,
  confirm,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  confirm: string;
  busy: boolean;
  onConfirm(): void;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby={id}
      onClose={onClose}
    >
      <h2 id={id}>{title}</h2>
      {children}
      <div className="account-actions">
        <button type="button" autoFocus onClick={onClose}>
          やめる
        </button>
        <button
          type="button"
          className="account-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {confirm}
        </button>
      </div>
    </dialog>
  );
}
