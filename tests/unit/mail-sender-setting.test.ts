import { describe, expect, test } from "vitest";
import {
  effectiveSender,
  MAX_SENDER_LENGTH,
  mailSenderSchema,
} from "@/features/admin/mail/domain/sender";

describe("sender typed in the panel", () => {
  test("accepts what the providers accept, trimmed", () => {
    expect(mailSenderSchema.parse({ sender: " Nelcota <oi@nelcota.app> " })).toEqual({
      sender: "Nelcota <oi@nelcota.app>",
    });
    expect(mailSenderSchema.parse({ sender: "oi@nelcota.app" })).toEqual({
      sender: "oi@nelcota.app",
    });
  });

  test("a blank field means the hosting's MAIL_FROM", () => {
    expect(mailSenderSchema.parse({ sender: "  " })).toEqual({ sender: null });
    expect(mailSenderSchema.parse({ sender: null })).toEqual({ sender: null });
  });

  test("refuses a malformed or oversized sender with the format to use", () => {
    const malformed = mailSenderSchema.safeParse({ sender: "Nelcota sem email" });
    expect(malformed.success).toBe(false);
    expect(malformed.error?.issues[0]?.message).toBe("Use Nome <email@dominio> ou só o e-mail.");
    const long = `${"a".repeat(MAX_SENDER_LENGTH)}@nelcota.app`;
    expect(mailSenderSchema.safeParse({ sender: long }).success).toBe(false);
  });

  test("the panel's sender wins over MAIL_FROM", () => {
    expect(effectiveSender({ sender: "Painel <p@x.app>" }, "Hospedagem <h@x.app>")).toEqual({
      value: "Painel <p@x.app>",
      fromPanel: true,
    });
    expect(effectiveSender({ sender: null }, "Hospedagem <h@x.app>")).toEqual({
      value: "Hospedagem <h@x.app>",
      fromPanel: false,
    });
    expect(effectiveSender({ sender: null }, undefined)).toEqual({ value: null, fromPanel: false });
  });
});
