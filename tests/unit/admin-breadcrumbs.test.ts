import { expect, test } from "vitest";
import { adminBreadcrumbs } from "@/features/admin/shell/domain/breadcrumbs";

const NAV = new Map([
  ["/admin/salas", "Salas"],
  ["/admin/conta/seguranca", "Segurança"],
]);

test("a segment with no page of its own is text, not a link to a 404", () => {
  expect(adminBreadcrumbs("/admin/conta/seguranca", NAV)).toEqual([
    { label: "Início", href: "/admin", current: false },
    { label: "Minha conta", href: null, current: false },
    { label: "Segurança", href: "/admin/conta/seguranca", current: true },
  ]);
});

test("a detail page links back to its list and calls itself Detalhes", () => {
  const id = "0196f3c2-7b1e-7c4a-9f00-1234567890ab";
  expect(adminBreadcrumbs(`/admin/salas/${id}`, NAV)).toEqual([
    { label: "Início", href: "/admin", current: false },
    { label: "Salas", href: "/admin/salas", current: false },
    { label: "Detalhes", href: `/admin/salas/${id}`, current: true },
  ]);
});
