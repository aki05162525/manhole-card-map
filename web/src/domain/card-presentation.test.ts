import { expect, it } from "vitest";
import { municipalityName } from "./card-presentation";
it("removes edition codes and preceding spaces with either bracket style", () => {
  expect(municipalityName("島本町 (A001)")).toBe("島本町");
  expect(municipalityName("東京23区 （A001）")).toBe("東京23区");
  expect(municipalityName("東京23区　（A001）")).toBe("東京23区");
  expect(municipalityName("東京23区（A001）")).toBe("東京23区");
  expect(municipalityName("東京23区（都心）")).toBe("東京23区（都心）");
});
