import { expect, test } from "vitest";
import { ADMIN_ROLES, ROLES_REQUIRING_2FA } from "@/features/auth/domain/roles";

test("every panel role needs 2FA, the reader included: it sees e-mails, IPs and browsers", () => {
  expect([...ROLES_REQUIRING_2FA].toSorted()).toEqual([...ADMIN_ROLES].toSorted());
});
