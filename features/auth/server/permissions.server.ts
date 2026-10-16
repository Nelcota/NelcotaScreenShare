import { createAccessControl } from "better-auth/plugins/access";
import type { AdminRole } from "@/features/auth/domain/roles";

/**
 * Panel permission matrix (docs/archive/admin-plan.md §5.2), single source.
 *
 * `user` and `session` are the Better Auth admin plugin resources and refer
 * to the ADMIN ACCOUNTS of this instance. Participants (app accounts)
 * are the `participant` resource.
 *
 * Left out of every role, on purpose: impersonating, deleting an admin,
 * setting another admin's password or e-mail.
 */
export const statements = {
  // Admin plugin (admin accounts)
  user: ["create", "list", "set-role", "ban", "get", "update"],
  session: ["list", "revoke", "delete"],
  adminInvitation: ["create", "revoke"],
  // Panel
  dashboard: ["read"],
  participant: ["read", "update", "delete", "export", "anonymize", "disableTwoFactor"],
  room: ["read", "update", "delete", "export"],
  shareSession: ["read", "export"],
  live: ["read", "kick", "close"],
  roomInvite: ["create", "revoke"],
  mail: ["read", "test"],
  audit: ["read", "export"],
  settings: ["read", "update"],
  beta: ["read", "update"],
  lgpd: ["read", "handle"],
  system: ["dbHealth", "status"],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole(statements),
  admin: ac.newRole({
    user: ["list", "get"],
    dashboard: ["read"],
    participant: ["read", "update", "delete", "export"],
    room: ["read", "update", "delete", "export"],
    shareSession: ["read", "export"],
    live: ["read", "kick", "close"],
    roomInvite: ["create", "revoke"],
    mail: ["read", "test"],
    audit: ["read"],
    settings: ["read"],
    beta: ["read", "update"],
    lgpd: ["read"],
    system: ["status"],
  }),
  viewer: ac.newRole({
    dashboard: ["read"],
    participant: ["read"],
    room: ["read"],
    shareSession: ["read"],
    live: ["read"],
  }),
} satisfies Record<AdminRole, unknown>;

type Resource = keyof typeof statements;
type Action<R extends Resource> = (typeof statements)[R][number];
/** Permission request: `{ room: ["close"] }`. */
export type PermissionRequest = { [R in Resource]?: readonly Action<R>[] };

/** Does the role have ALL the requested permissions? */
export function can(role: AdminRole, request: PermissionRequest): boolean {
  // The Better Auth type asks for mutable arrays; the copy does not change the content.
  const copy = Object.fromEntries(
    Object.entries(request).map(([resource, actions]) => [resource, [...(actions ?? [])]]),
  );
  return roles[role].authorize(copy).success;
}
