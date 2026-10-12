const TEAM_ROLES = ["owner", "manager", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export function managesTeam(role: TeamRole) {
  return role === "owner" || role === "manager";
}
export function eligibleTeamHost(role: TeamRole, memberCanHost: boolean) {
  return managesTeam(role) || memberCanHost;
}
