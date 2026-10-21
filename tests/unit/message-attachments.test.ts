import { describe, expect, test } from "vitest";
import {
  ATTACHMENT_LIMITS,
  attachmentLimit,
  cleanFileName,
  detectAttachmentKind,
  hasBlockedExtension,
} from "@/features/messages/domain/attachments";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("the size limit per file", () => {
  test("follows the sender's plan, with the ceiling only between panel owners", () => {
    expect(attachmentLimit({ senderPro: false, everyoneIsOwner: false })).toBe(10 * 1024 * 1024);
    expect(attachmentLimit({ senderPro: true, everyoneIsOwner: false })).toBe(
      ATTACHMENT_LIMITS.pro,
    );
    expect(attachmentLimit({ senderPro: false, everyoneIsOwner: true })).toBe(1024 * 1024 * 1024);
  });
});

describe("the file name", () => {
  test("keeps only the name, without folders or control characters", () => {
    expect(cleanFileName("C:\\Users\\ana\\relatório final.pdf")).toBe("relatório final.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("nota\u0000.txt")).toBe("nota.txt");
  });

  test("refuses an empty or too long name", () => {
    expect(cleanFileName("   ")).toBeNull();
    expect(cleanFileName("pasta/")).toBeNull();
    expect(cleanFileName(`${"a".repeat(201)}.txt`)).toBeNull();
  });

  test("programs are refused by name, whatever the case or a second extension", () => {
    for (const name of ["setup.exe", "FOTO.PNG.EXE", "run.bat", "script.ps1", "app.jar", "x.vbs"]) {
      expect(hasBlockedExtension(name), name).toBe(true);
    }
    for (const name of ["foto.png", "notas.txt", "projeto.zip", "sem-extensao"]) {
      expect(hasBlockedExtension(name), name).toBe(false);
    }
  });
});

describe("the type from the first bytes", () => {
  test("knows the accepted kinds", () => {
    expect(detectAttachmentKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image",
    );
    expect(detectAttachmentKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image");
    expect(detectAttachmentKind(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image");
    expect(detectAttachmentKind(text("%PDF-1.7"))).toBe("pdf");
    expect(detectAttachmentKind(bytes(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
    expect(detectAttachmentKind(text("ID3\u0004"))).toBe("audio");
    expect(detectAttachmentKind(text("RIFF\u0000\u0000\u0000\u0000WAVEfmt "))).toBe("audio");
    expect(detectAttachmentKind(text("\u0000\u0000\u0000\u0018ftypM4A "))).toBe("audio");
    expect(detectAttachmentKind(text("\u0000\u0000\u0000\u0018ftypisom"))).toBe("video");
    expect(detectAttachmentKind(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video");
    expect(detectAttachmentKind(text("olá, isto é texto\n"))).toBe("text");
  });

  test("an SVG is only text: it downloads as a file, never shows as an image", () => {
    expect(detectAttachmentKind(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("text");
  });

  test("a program renamed to .png is refused by its content", () => {
    // "MZ" with the zeros of a Windows program header.
    expect(detectAttachmentKind(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00))).toBeNull();
    expect(detectAttachmentKind(bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00))).toBeNull();
  });

  test("text cut in the middle of a character still counts; other binary does not", () => {
    expect(detectAttachmentKind(text("ação").subarray(0, 3))).toBe("text");
    expect(detectAttachmentKind(bytes(0xc3, 0x28, 0x41))).toBeNull();
    expect(detectAttachmentKind(bytes())).toBeNull();
  });
});
