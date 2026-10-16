import { expect, test } from "vitest";
import { activeSection } from "@/features/privacy/domain/active-section";

const at = (first: number) => [
  { id: "o-que-guardamos", top: first },
  { id: "o-que-nao-guardamos", top: first + 1400 },
  { id: "seus-direitos", top: first + 2000 },
];

test("the section whose title passed the reading line is the one highlighted", () => {
  // 02 starts at 200 px while the long 01 still fills the top: 02 is being read.
  expect(activeSection(at(-1200), 250, false)).toBe("o-que-nao-guardamos");
  expect(activeSection(at(-1200), 150, false)).toBe("o-que-guardamos");
});

test("before the first section, the first one; at the end of the page, the last one", () => {
  expect(activeSection(at(600), 250, false)).toBe("o-que-guardamos");
  expect(activeSection(at(-1700), 250, true)).toBe("seus-direitos");
  expect(activeSection([], 250, false)).toBeUndefined();
});
