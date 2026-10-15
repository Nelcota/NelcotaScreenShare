import { expect, test } from "vitest";
import { sessionEndConfirmation } from "@/features/security/domain/session-end";

/** Ending sessions in Configurações > Sessões ran on one click. */
test("ending one session names the device", () => {
  const asked = sessionEndConfirmation({
    kind: "one",
    sessionId: "s",
    device: "Chrome no Windows",
  });
  expect(asked.title).toBe("Encerrar esta sessão?");
  expect(asked.description).toContain("Chrome no Windows");
});

test("ending the others counts them and says this one stays", () => {
  expect(sessionEndConfirmation({ kind: "others", count: 1 }).title).toBe(
    "Encerrar a outra sessão?",
  );
  const many = sessionEndConfirmation({ kind: "others", count: 3 });
  expect(many.title).toBe("Encerrar as 3 outras sessões?");
  expect(many.description).toContain("Este continua conectado.");
});
