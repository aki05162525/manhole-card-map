import { expect, it } from "vitest";
import { noSwitch, settleSwitch, startSwitch } from "./screen-switch";

it("shows or falls back only for the switch started last", () => {
  const first = startSwitch(noSwitch);
  const second = startSwitch(first.state);
  for (const loaded of [true, false])
    expect(
      settleSwitch(second.state, { id: first.id, loaded, inPlace: true }),
    ).toBe("drop");
  expect(
    settleSwitch(second.state, { id: second.id, loaded: true, inPlace: true }),
  ).toBe("show");
  expect(
    settleSwitch(second.state, { id: second.id, loaded: false, inPlace: true }),
  ).toBe("fallback");
});

it("drops the last switch too once the history has moved elsewhere", () => {
  const { state, id } = startSwitch(noSwitch);
  for (const loaded of [true, false])
    expect(settleSwitch(state, { id, loaded, inPlace: false })).toBe("drop");
});
