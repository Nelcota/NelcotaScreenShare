import assert from "node:assert/strict";
import { test } from "vitest";
import {
  CHAT_TEXT_MAX_BYTES,
  cleanTextFileName,
  plainText,
  textFileProblem,
  textPreview,
} from "@/features/room/domain/chat-files";

const encode = (text: string) => new TextEncoder().encode(text);

test("only a .txt of up to 1 MB can be picked", () => {
  assert.equal(textFileProblem({ name: "notas.TXT", size: 10 }), undefined);
  assert.equal(
    textFileProblem({ name: "foto.png", size: 10 }),
    "Envie só arquivos de texto (.txt).",
  );
  assert.equal(
    textFileProblem({ name: "log.txt", size: CHAT_TEXT_MAX_BYTES + 1 }),
    "O arquivo passa de 1 MB.",
  );
});

test("only plain UTF-8 text within 1 MB counts as text", () => {
  assert.equal(plainText(encode("Olá,\tmundo\r\nlinha 2")), "Olá,\tmundo\r\nlinha 2");
  // A program renamed to .txt: invalid UTF-8.
  assert.equal(plainText(Uint8Array.of(0x4d, 0x5a, 0x90, 0x00, 0xff, 0xfe)), undefined);
  // Valid UTF-8 with control characters is not plain text either.
  assert.equal(plainText(encode("abc\u0000def")), undefined);
  assert.equal(plainText(encode("\u001b[31mvermelho")), undefined);
  assert.equal(plainText(new Uint8Array(CHAT_TEXT_MAX_BYTES + 1)), undefined);
});

test("a file name is cleaned of folders, extra extensions and length", () => {
  assert.equal(cleanTextFileName("../../etc/passwd.txt"), "passwd.txt");
  assert.equal(cleanTextFileName(String.raw`C:\Users\Ana\nota.txt`), "nota.txt");
  assert.equal(cleanTextFileName("nota.txt.exe"), "nota_txt_exe.txt");
  assert.equal(cleanTextFileName("a\u0007b.txt"), "ab.txt");
  assert.equal(cleanTextFileName(".txt"), "arquivo.txt");
  assert.equal(cleanTextFileName(`${"x".repeat(200)}.txt`).length, 80);
});

test("the preview shows the first lines, each one short", () => {
  const lines = Array.from({ length: 30 }, (_, index) => `linha ${index}`).join("\n");
  assert.equal(textPreview(lines).split("\n").length, 12);
  assert.equal(textPreview("a".repeat(500)).length, 200);
});
