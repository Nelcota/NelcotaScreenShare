/**
 * What the Times page shows, by the person's situation. Only text and which block
 * appears depend on it; the server still decides who may create a team.
 * - `without-pro`: no Pro and no team yet, one message in the middle and the Pro list.
 * - `pro-off`: no Pro, but already in teams: the teams, without the creation form.
 * - `unavailable`: Pro, but teams are not turned on in this deployment yet.
 * - `create`: Pro and teams on: the teams and the creation form.
 */
export type TeamsPageView = "without-pro" | "pro-off" | "unavailable" | "create";

export function teamsPageView({
  proActive,
  enabled,
  teamCount,
}: {
  proActive: boolean;
  enabled: boolean;
  teamCount: number;
}): TeamsPageView {
  if (!proActive && teamCount === 0) return "without-pro";
  if (!proActive) return "pro-off";
  if (!enabled) return "unavailable";
  return "create";
}
