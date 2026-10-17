import assert from "node:assert/strict";
import { test } from "vitest";
import { roomAddressSchema, usesReservedWord } from "@/features/rooms/domain/room-address";

test("a chosen address follows the room code rule and is kept lowercase", () => {
  assert.equal(roomAddressSchema.parse("  Nelcota-Staff "), "nelcota-staff");
  for (const bad of ["ab", "-sala", "sala-", "sala com espaço", "sala_da_ana", "a".repeat(33)]) {
    assert.equal(roomAddressSchema.safeParse(bad).success, false, bad);
  }
});

test("an address with a blocked term is refused like any public text", () => {
  const refused = roomAddressSchema.safeParse("sala-n4z1");
  assert.equal(refused.success, false);
  assert.equal(refused.error?.issues[0]?.message, "Esse texto não pode ser usado.");
});

test("reserved words are found as a part of the address or, for the service's names, inside one", () => {
  for (const code of [
    "nelcota-staff",
    "pix-pagamento",
    "verificacao-conta",
    "time-suporte",
    "superadmin",
  ]) {
    assert.equal(usesReservedWord(code), true, code);
  }
  for (const code of ["reuniao-semanal", "time-do-joao", "kfa-mtrx-q2p", "contador-de-historias"]) {
    assert.equal(usesReservedWord(code), false, code);
  }
});
