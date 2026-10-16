/**
 * Admin panel roles. Single source: the CHECK on the `admin_users.role` column,
 * the Better Auth access control and the permission matrix all start here.
 */
export const ADMIN_ROLES = ["owner", "admin", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Dono",
  admin: "Administrador",
  viewer: "Leitor",
};

/**
 * Roles that need active 2FA to use the panel: all of them. The reader changes nothing,
 * but sees participants' e-mails, IPs and browsers.
 */
export const ROLES_REQUIRING_2FA: readonly AdminRole[] = [...ADMIN_ROLES];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}
