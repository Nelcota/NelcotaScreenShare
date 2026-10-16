import assert from "node:assert/strict";
import { test } from "vitest";
import { hasBlockedTerm } from "@/features/moderation/domain/blocked-terms";

test("a blocked word is refused whatever its case, accents or separators", () => {
  for (const text of ["heil", "HEIL", "Sala do Heil", "sala-heil-2", "estúpro", "porn.room"]) {
    assert.equal(hasBlockedTerm(text), true, text);
  }
});

test("digits and symbols in place of letters do not hide a term", () => {
  for (const text of ["n4z1", "h1tl3r-fans", "p0rn0", "Pedó-filo", "pedof1lia"]) {
    assert.equal(hasBlockedTerm(text), true, text);
  }
});

test("roots with no innocent use are refused inside other words", () => {
  for (const text of ["neonazis", "superhitler", "time-pedofilo", "supremacia branca"]) {
    assert.equal(hasBlockedTerm(text), true, text);
  }
});

test("hate codes made of numbers are refused as written", () => {
  assert.equal(hasBlockedTerm("sala-1488"), true);
});

test("normal names pass, including words that only offend by context", () => {
  for (const text of [
    "Time Preto e Branco",
    "nelcota-staff",
    "Sala do Macaco",
    "Reunião de segunda",
    "kfa-mtrx-q2p",
    "Copa 2026",
    "Pedro e Ana",
    "massagem relaxante",
    "Ana Zimmer",
    "Supremacia do time branco",
  ]) {
    assert.equal(hasBlockedTerm(text), false, text);
  }
});
