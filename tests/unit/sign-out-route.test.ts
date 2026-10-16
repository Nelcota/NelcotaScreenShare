import { expect, test } from "vitest";
import * as signOut from "@/app/routes/sign-out";

/** A typed /sair or a bot's GET goes home quietly; signing out stays a POST. */
test("GET /sair sends home instead of an error", async () => {
  expect(signOut.loader).toBeTypeOf("function");
  const response = await Promise.resolve(signOut.loader?.()).catch((thrown: unknown) => thrown);
  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response)) return;
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/");
});
