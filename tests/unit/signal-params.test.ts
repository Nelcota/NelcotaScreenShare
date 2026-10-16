import { expect, test } from "vitest";
import { clientSignalParams } from "@/features/room/domain/signal-params";

const protocolOf = (query: string) =>
  new Map(clientSignalParams(new URLSearchParams(query))).get("protocol");

test("the relay keeps a protocol it knows and falls back to 16 for anything else", () => {
  expect(protocolOf("protocol=17")).toBe("17");
  expect(protocolOf("protocol=16")).toBe("16");
  expect(protocolOf("protocol=1")).toBe("16");
  expect(protocolOf("protocol=99")).toBe("16");
  expect(protocolOf("protocol=16%26join_request%3Dx")).toBe("16");
  expect(protocolOf("")).toBe("16");
});

test("other client options pass only when short, and nothing outside the list", () => {
  const params = new Map(
    clientSignalParams(
      new URLSearchParams({
        sdk: "js",
        auto_subscribe: "0",
        access_token: "forjado",
        join_request: "x",
        version: "x".repeat(129),
      }),
    ),
  );
  expect(params.get("sdk")).toBe("js");
  expect(params.get("auto_subscribe")).toBe("0");
  expect(params.has("access_token")).toBe(false);
  expect(params.has("join_request")).toBe(false);
  expect(params.has("version")).toBe(false);
});
