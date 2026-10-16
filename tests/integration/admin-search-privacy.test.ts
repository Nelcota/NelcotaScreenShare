import { RouterContextProvider } from "react-router";
import { expect, test } from "vitest";
import { searchPanelAction } from "@/features/admin/search/actions";

/**
 * The panel search carries names and e-mails: it goes in a POST body, never in the URL,
 * where proxies and access logs keep it.
 */
const { action, loader } = await import("@/app/routes/api/operations");
const ID = "admin-search-searchPanelAction";

function request(method: "GET" | "POST") {
  const payload = encodeURIComponent(JSON.stringify({ input: { q: "ana@exemplo.com" } }));
  const url = `http://localhost:3000/api/operations/${ID}${method === "GET" ? `?payload=${payload}` : ""}`;
  return {
    request: new Request(url, {
      method,
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify({ input: { q: "ana@exemplo.com" } }) } : {}),
    }),
    params: { operation: ID },
    url: new URL(url),
    pattern: "/api/operations/:operation",
    context: new RouterContextProvider(),
  };
}

test("the page calls the search with POST, without refreshing the page's data", () => {
  expect(searchPanelAction.method).toBe("post");
  expect(searchPanelAction.mutates).toBe(false);
});

test("the server refuses the search by GET, with the term in the URL", async () => {
  const response = await loader(request("GET"));
  expect(response.status).toBe(405);
  expect(response.headers.get("Allow")).toBe("POST");
  // By POST it reaches the operation (without a session: "sessão expirou").
  const posted = await action(request("POST"));
  expect(posted.status).toBe(200);
});
