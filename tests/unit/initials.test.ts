import { expect, test } from "vitest";
import { initials } from "@/lib/initials";

test("first and last name, ignoring the guest label", () => {
  expect(initials("Ana Souza")).toBe("AS");
  expect(initials("  maria  da   silva ")).toBe("MS");
  expect(initials("Visita (convidado)")).toBe("V");
  expect(initials("Ana Souza (convidado)")).toBe("AS");
  expect(initials("Éric")).toBe("É");
  expect(initials("")).toBe("?");
  expect(initials("(convidado)")).toBe("?");
});
