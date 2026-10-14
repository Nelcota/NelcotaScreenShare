import { describe, expect, test } from "vitest";
import { displayNameSchema } from "@/features/room/domain/participant-label";

const RESERVED = "Esse nome não pode ser usado.";

function issueOf(name: string) {
  const parsed = displayNameSchema.safeParse(name);
  return parsed.success ? null : parsed.error.issues[0]?.message;
}

describe("display name", () => {
  test.each([
    "Equipe Nelcota",
    "nelcotaoficial",
    "NÉLCOTA",
    "Suporte",
    "suporte técnico",
    "Admin",
    "Ana (admin)",
    "ADMIN Bia",
  ])("refuses names that pose as the service: %s", (name) => {
    expect(issueOf(name)).toBe(RESERVED);
  });

  test.each(["Ana", "Administradora Bia", "Badminton", "Caio 🎮"])(
    "keeps ordinary names: %s",
    (name) => {
      expect(issueOf(name)).toBeNull();
    },
  );
});
