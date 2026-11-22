import { useId, useState, type FormEvent } from "react";
import {
  DEFAULT_SEAL,
  SEAL_FRAMES,
  SEAL_INKS,
  type Seal,
  type SealFrame,
  type SealInk,
} from "../../contract/seal";
import { firstGrapheme, longerThan } from "../../contract/text";
import { SealMark } from "../../shared/ui/seal";
import { SEAL_RULE } from "./messages";

const frameNames: Record<SealFrame, string> = {
  double: "二重丸",
  round: "丸",
  oval: "小判",
  square: "角",
  octagon: "八角",
  cover: "蓋",
};
// A stamp pad's inks, by the names they are sold under.
const inkNames: Record<SealInk, string> = {
  vermilion: "朱",
  indigo: "藍",
  patina: "緑青",
  purple: "紫",
  sumi: "墨",
};

/**
 * The seal's settings. Each choice is drawn as the seal it would make with
 * the rest as chosen so far, so the choices are their own preview. Mounted
 * again (`key`) for another saved seal.
 */
export function SealForm({
  seal = DEFAULT_SEAL,
  name,
  busy,
  onSubmit,
}: {
  seal?: Seal | undefined;
  name: string;
  busy: boolean;
  onSubmit(seal: Seal): void;
}) {
  const id = useId();
  const [frame, setFrame] = useState(seal.frame);
  const [ink, setInk] = useState(seal.ink);
  const [typed, setTyped] = useState(seal.char ?? "");
  const [error, setError] = useState("");
  const char = typed.normalize("NFC").trim();
  // As it would be pressed: one character, whatever has been typed so far.
  const draft: Seal = { frame, ink, char: firstGrapheme(char) || null };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (longerThan(char, 1)) return setError(SEAL_RULE);
    setError("");
    onSubmit(draft);
  };
  return (
    <form onSubmit={submit} className="seal-form" noValidate>
      <div className="seal-preview">
        <SealMark seal={draft} name={name} />
        <p className="account-hint">
          表示名と一緒に、フレンドと、招待リンクを開いた人・申請を受け取った人に表示します。
        </p>
      </div>
      <fieldset>
        <legend>形</legend>
        <div className="seal-choices">
          {SEAL_FRAMES.map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name={id + "frame"}
                checked={frame === choice}
                onChange={() => setFrame(choice)}
              />
              <SealMark seal={{ ...draft, frame: choice }} name={name} />
              {frameNames[choice]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>色</legend>
        <div className="seal-choices">
          {SEAL_INKS.map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name={id + "ink"}
                checked={ink === choice}
                onChange={() => setInk(choice)}
              />
              <SealMark seal={{ ...draft, ink: choice }} name={name} />
              {inkNames[choice]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="account-form">
        <label htmlFor={id + "char"}>文字</label>
        <div className="account-inline">
          <input
            id={id + "char"}
            className="seal-char"
            value={typed}
            placeholder={firstGrapheme(name)}
            autoComplete="off"
            onChange={(event) => {
              setTyped(event.currentTarget.value);
              setError("");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={id + (error ? "error" : "hint")}
          />
          <button type="submit" disabled={busy}>
            印を変更する
          </button>
        </div>
        {error ? (
          <p id={id + "error"} className="account-error">
            {error}
          </p>
        ) : (
          <p id={id + "hint"} className="account-hint">
            空欄にすると、表示名の1文字目になります。
          </p>
        )}
      </div>
    </form>
  );
}
