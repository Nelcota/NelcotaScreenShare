import { expect, test } from "vitest";
import { fieldErrorOf } from "@/lib/operations/field-error";

test("a field's validation message reaches the form; anything else is ignored", () => {
  const failed = { validationErrors: { fieldErrors: { name: ["Use pelo menos 2 caracteres."] } } };
  expect(fieldErrorOf(failed, "name")).toBe("Use pelo menos 2 caracteres.");
  expect(fieldErrorOf(failed, "email")).toBeUndefined();
  expect(fieldErrorOf({}, "name")).toBeUndefined();
  expect(fieldErrorOf({ validationErrors: { formErrors: ["x"] } }, "name")).toBeUndefined();
});
