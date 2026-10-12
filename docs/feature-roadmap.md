# Nelcota feature implementation plan

Status: proposed implementation plan. Updated: 2026-10-12.

Implementation started on `feature/room-audio-profiles`. The room/session design and
local self-hosted admission experiment are recorded in [ADR 0006](adr/0006-room-definitions-and-session-authority.md).
Individual audio and sharing profiles are implemented and locally validated. Host authority
and controls are implemented on `feature/room-host-controls`, behind an opt-in private
signaling gate. See [host controls](host-controls.md) for the required deployment boundary.
Annotations, permanent rooms and team workspaces remain planned. Real-device media
baselines and pilot rollout remain part of release validation.

Local validation on 2026-10-12 passed formatting, typecheck, lint, build, Knip and
duplication checks, 491 unit/integration tests with real Postgres, and the complete
49-test Chromium E2E suite. The three new audio/profile E2E cases were rerun after the
panel-height adjustment, including signaling reconnection, track replacement, navigation
and viewport-bound checks. Local checks used Node 26.11.1; the repository runtime target
remains Node 26.9.

The host-controls phase passed formatting, typecheck, lint, production build, Knip and
duplication checks, 508 unit/integration tests with real Postgres, and 49 existing Chromium
E2E cases. Three dedicated E2E cases passed with the private signaling gate enabled,
including cached/refreshed JWT rejection, sharing revocation with microphone preservation,
transfer, terminal closure, reconnection under lock and navigation. Desktop/mobile panels
were visually checked. CI runs both admission modes. The actual VPS network boundary and
production rollout remain release validation tasks.

The dependency audit reports one pre-existing high-severity finding in `braces@3.0.3`,
reachable through the `shadcn` development dependency. The host-controls phase adds the
WebSocket transport dependency. The advisory lists no patched release; this remains a
CI audit failure to address independently. [GitHub advisory GHSA vfj7 8cjw p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Build the six features in three releases: individual audio controls and sharing profiles;
host controls and temporary annotations; then permanent rooms and a team workspace. The
first release improves every call. The second establishes room authority. The third gives
teams a reason to return and supplies the product foundation for Pro.

The estimates assume one developer working full time, the existing React Router and
LiveKit architecture, and incremental pull requests. Implementation, relevant tests and
review fixes take an estimated 34–50 working days. A 20% contingency gives approximately
41–60 working days, or 8–12 weeks. Reestimate after the foundation work and each release;
these are planning ranges, not delivery commitments.

## Scope and product defaults

| Feature          | First version                                                                                | Product placement proposed |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------- |
| Individual audio | Separate voice and shared-screen volume per remote participant, local mute and reset         | Free                       |
| Sharing profiles | Automatic, Text, Video and Data saver before capture                                         | Free                       |
| Host controls    | Remove, lock admission, end the session, restrict screen sharing and transfer host authority | Free                       |
| Annotations      | Temporary arrows, circles and freehand marks with authorship and clearing                    | Free                       |
| Permanent rooms  | Named rooms, stable links, archive and personal favorites                                    | Pro beta                   |
| Team workspace   | Membership, invitations, shared permanent rooms and session history                          | Pro beta                   |

Keep guest joining and the current room shortcuts. Use the existing UI tokens, responsive
layouts and reduced-motion behavior. A participant's audio choices affect only that
participant's playback. Annotations expire and session history contains session metadata.
Keep the current promise that screen content, audio and chat are not recorded.

Use manual, audited Pro entitlements for pilot accounts and the initial team beta. Paid subscription checkout
is a separate project with its own estimate. Public paid launch also requires settling
the participant limits and time policy advertised by the current pricing page. The
roadmap's estimate covers these six features and the beta entitlement checks.

## Current architecture and dependencies

- `features/room/ui/dock/Deafen.tsx` owns the single room audio renderer and the behavior
  that turns the microphone off while deafened. New audio controls must preserve that
  behavior and the live call while navigating between pages.
- `features/room/hooks/use-screen-share.ts` currently picks 1080p at 30 fps for a browser
  tab and 1080p at 15 fps for a window or monitor. It already protects against shared
  audio echo and cleans up failed publication.
- `PointerLayer.tsx`, `content-box.ts` and `data-channel.ts` provide normalized coordinates,
  sender validation and throttling that annotations can extend.
- `hostPresent` currently means any signed-in account is connected. It does not establish
  moderator authority. `rooms.createdByUserId` is inferred from token requests during
  webhook projection; it must not authorize host operations.
- The `rooms` projection reuses a row when the same room code reopens. Permanent links
  need a durable room definition and a separate record for each call.
- Participant accounts, admin accounts, audit recording, account export/deletion and
  integration/E2E infrastructure already exist. Team roles belong to participant
  accounts and must not grant access to the platform admin panel.

The delivery dependencies are:

| Work                                  | Required first                                                 |
| ------------------------------------- | -------------------------------------------------------------- |
| Individual audio and sharing profiles | Foundation decisions; each can ship independently              |
| Host controls                         | Authoritative session creation and admission model             |
| Annotations                           | Audio/image release and the host/presenter authorization rules |
| Permanent rooms                       | Room definition and session separation; host controls          |
| Team workspace                        | Permanent rooms, membership authorization and Pro entitlements |
| Broad release                         | Migration, compatibility and release validation                |

## Phase 0 Foundation and technical decisions

Estimate: 2–3 working days.

Record a focused ADR for room definitions, live sessions and authority. Define the first
successful authorized creator as the initial host of an ad hoc call. Claim authority in
a database transaction during session creation, before returning media credentials.
Guests cannot claim host authority. Use a unique active-session constraint and a lock per
room definition so concurrent joins produce one session and one host.

Specify pending session expiry when the creator receives a token but never connects. A
temporary host disconnect preserves authority for a proposed 60-second reconnect window;
then transfer to the longest-connected eligible account. If only guests remain, disable
host-only operations and keep admission closed until an eligible account returns or the
room empties. A team room will later use its team roles to determine eligible hosts.

Run three short feasibility checks:

1. Apply independent gains to voice and shared-screen audio, including track replacement
   and deafening. Confirm the current renderer will not overwrite individual gains.
2. Compare text readability, motion and bandwidth for the three sharing presets. Start
   with 1080p/15 fps, 1080p/30 fps and 720p/15 fps respectively, treating these as requested
   capture targets that browsers and network conditions can reduce.
3. Attempt direct reconnection with both an original JWT and a server-refreshed JWT after
   removal, admission locking, session closure and permission changes on the deployed
   self-hosted LiveKit version. Document the resulting enforcement boundary.

LiveKit documents token revocation as Cloud-only; self-hosted removal does not invalidate
existing tokens, and connected clients can receive refreshed tokens. Short application
token lifetimes and refusing new issuance therefore do not establish immediate revocation
by themselves. [LiveKit token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/).

Deliver an ADR, a browser/network baseline and an explicit admission guarantee. Strict
immediate exclusion requires an additional enforceable admission mechanism or a transport
with revocation support; estimate that separately if required. Keep the default hosting
model and describe any residual token validity accurately in the moderation UI. Identity
exclusions also cannot identify a guest who discards their cookie; locking new admissions
provides the room-level control.

## Phase 1 Individual audio controls

Estimate: 2–3 working days.

Add an audio menu to each remote participant and an accessible equivalent in the compact
people list. Include two sliders, Voice and Shared audio, from 0% to 100%, plus local mute
and reset. Disable the shared-audio control when that participant has no such track.
Default both sources to 100%. Keep a mute action distinct from the slider value so unmute
can restore the previous level.

Store preferences in memory for the current call, keyed by participant identity and
track source, rather than track SID. Reapply them after resubscription or reconnection;
clear them when the user leaves the call. Avoid persistent guest identifiers in browser
storage. Put gain rules in the room domain and the track lifecycle in a dedicated hook.
Use one audio rendering path and keep it above the route-owned layout.

`RemoteAudioTrack.setVolume` is available for track playback. Choose either controlled
track rendering or explicit track gains after the feasibility check; never mount two
renderers for the same audio. [LiveKit audio track API](https://docs.livekit.io/reference/client-sdk-js/classes/RemoteAudioTrack.html).

Acceptance criteria:

- Changing one person's voice gain leaves their shared audio and everyone else unchanged.
- Local mute does not mute that person for other listeners.
- Deafening overrides every gain; hearing again restores gains and the existing microphone
  restoration behavior.
- New tracks, reconnection and navigation retain the settings without duplicated playback.
- Sliders work with keyboard input, have labels and expose their values to assistive tools.

Verify gain/mute rules with unit tests, track lifecycle with a focused integration-style
client test, and the UI/deafening flow with Playwright. Confirm audible separation with
two browser profiles using voice and a shared tab.

## Phase 2 Sharing profiles

Estimate: 3–4 working days.

Extend the existing share menu with Automatic, Text, Video and Data saver. Automatic stays
the default and preserves the current surface-based choice. Text prioritizes readability;
Video prioritizes motion; Data saver lowers resolution and bandwidth demand. Save the
choice on this browser independently from its audio preference, with a versioned value
and an Automatic fallback for unsupported or corrupt storage.

Put the mapping from profile to capture and encoding options in `domain/share-profile.ts`.
Pass the selected profile through `ShareChoice` and `use-screen-share.ts`. Retain echo
protection, browser capability messages and complete cleanup on cancellation or failure.
Choose a profile before capture in the first version; changing it applies to the next
share, and the UI states that clearly.

LiveKit exposes resolution and text/detail/motion content hints; these are options for
the implementation, not guarantees of the received image quality.
[LiveKit capture options](https://docs.livekit.io/reference/client-sdk-js/interfaces/ScreenShareCaptureOptions.html).

Acceptance criteria:

- The four choices map to the intended capture/encoding options, and Automatic matches
  today's behavior.
- A cancelled picker or failed publication leaves no captured tracks running.
- Profiles preserve audio inclusion and prevent room-audio echo.
- Text remains readable in the agreed fixture; Video remains usable under the agreed
  network baseline; Data saver reduces measured traffic in the same scenario.
- Unsupported browsers show the existing explanation and keep a usable fallback.

Use unit tests for the mapping and Playwright for selection/persistence. Compare actual
resolution, FPS, bitrate and readability manually on supported desktop browsers. Avoid
asserting a fixed FPS in E2E because the browser and network can lower it.

Release A is ready after phases 0–2: an estimated 7–10 working days before contingency.

## Phase 3 Host controls and session authority

Estimate: 6–9 working days, subject to the admission feasibility result.

Implement the minimal room definition/session model from the ADR, including unique media
room names per session and their webhook mapping. Store host authority,
admission lock, sharing policy, session state and identity exclusions independently from
the webhook projection. Return only the capabilities needed by the UI. Show the host
badge and put actions in the room menu and participant menu.

Deliver removal from the current call, locking new admissions, ending the call, a policy
for who may publish screen tracks and explicit host transfer to another eligible account.
Default sharing to Everyone; support Host only and Specific people. Restrict the screen
and screen-audio sources together while keeping microphone permissions intact. The server
derives the acting account from its session and checks current room authority on every
action. Client-supplied role labels and data-channel messages cannot grant authority.

Implement operations under `features/room/actions.server.ts`, registered through
`app/operations.server.ts`, with Zod, trusted-origin checks, rate limits and audit records.
Extend the existing LiveKit gateway for participant updates, removal and session closure;
keep media admin grants and secrets on the server.

Database updates and LiveKit calls cannot share a transaction. Record a durable command
and its audit entry with the policy change, apply the LiveKit effect, then record its
outcome. Retry pending commands through the existing maintenance lifecycle. Show pending
or failed states until the transport effect succeeds. Serialise host transfer and closure,
and make repeated removal/closure requests safe.

Admission locking rejects fresh entrants while allowing previously admitted, nonexcluded
identities to reconnect. Ending an ad hoc call makes that session terminal. A permanent
room can start a new session later with a new media room name. Check exclusions and active
policy before every application token issuance. Implement and expose the measured
old-token limitation from phase 0; an immediate ban is a separate release gate when the
transport cannot enforce it.

Acceptance criteria:

- Two simultaneous creators cannot become host of the same session.
- Guests and ordinary participants receive authorization failures for host operations.
- Locking blocks new token admission, preserves permitted reconnects and survives refresh.
- Removal, closure and screen restrictions work on the actual LiveKit deployment, including
  attempts with cached/refreshed tokens; guarantees match the documented boundary.
- Host transfer handles departure and concurrent requests without leaving two hosts.
- A LiveKit failure is visible and can be retried without losing its audit trail.

Test pure policies, real Postgres concurrency and audit transactions, API authorization,
and multi-client moderation/reconnection. Include forged requests and old-token transport
tests, rather than checking only whether buttons are hidden.

## Phase 4 Temporary collaborative annotations

Estimate: 5–7 working days.

Extend the stage tools with Arrow, Circle and Pen. Display author names, use normalized
image coordinates and reuse the existing video content box so marks align across sizes,
letterboxing and fullscreen. Marks expire after a proposed 10 seconds. Authors can remove
their own marks; the presenter and host can clear the stage. Provide a keyboard path for
placing arrow endpoints and circles alongside the existing keyboard pointer.

Use versioned schemas with session ID, track SID, annotation epoch, mark ID, shape and
bounded coordinates. Derive authorship from the actual LiveKit sender. Keep previews small
and lossy; send completed shapes with reliable delivery. Cap point counts, message bytes,
send rates and active marks on both sending and receiving sides. Treat reliable delivery
as best effort, since disconnected recipients miss packets and the server does not retain
them. [LiveKit data packet behavior](https://docs.livekit.io/transport/data/packets/).

Authorize clear-all and epoch changes on the server, including guest presenters through
the existing signed guest session mechanism. Broadcast the resulting epoch and let
clients reread current state after reconnecting. Start newcomers with an empty temporary
overlay. Reject shapes from old epochs and clear all marks when capture ends, changes
source or changes resolution. Native video Picture in Picture may omit overlays; label
that limitation and verify it instead of promising annotation rendering there.

Acceptance criteria:

- Marks align in fullscreen and after resize, and expire within the configured lifetime.
- Sender identity cannot be forged to delete another author's mark or impersonate a host.
- Oversized, malformed and excessive messages are dropped without disrupting playback.
- Source changes, clear-all and reconnects never resurrect old annotations.
- Annotation mode does not intercept chat typing or disabled room shortcuts.

Test geometry, schemas, limits, author permissions and epochs; then use multiple browser
clients for drawing, clearing and reconnection. Perform manual touch, keyboard and
fullscreen checks.

Release B is ready after phases 3–4: an additional 11–16 working days before contingency
and any separately estimated admission enforcement work.

## Phase 5 Permanent rooms and favorites

Estimate: 5–7 working days.

Expose the room definitions introduced with host controls as named, permanent rooms.
Provide `/salas` for My rooms, Favorites and Create room; keep the existing
`/sala/:codigo` entry URL and streamer-mode address masking. A room definition owns its
public code, name and owner. Each new call gets a session ID and a unique internal media
room name. Map media webhook names back to the definition and session before projecting
events.

Support creation, rename, archive, favorite/unfavorite, copying the stable link and
starting/ending calls. Personal rooms initially belong to their creating account; phase 6
adds team ownership. Favoriting never grants room access. Archived rooms reject new
sessions and show a useful landing state. Require ending the active call before archiving
its room. Resolve Pro entitlement on the server for creation and enforce the configured
room allowance there. Introduce the beta entitlement record and an audited platform-admin
operation for provisioning personal pilot accounts in this phase; extend it to teams in
phase 6.

Extend participant records with the session association so team history can later show
separate calls for the same public code. Preserve legacy projection readers during the
migration. Backfill only the session boundaries supported by recorded data; do not invent
historical calls from overwritten timestamps. Distinguish owner identity from the live
host so an account can own a room without remaining connected to every call.

Acceptance criteria:

- The link stays unchanged across renames and successive calls.
- Two simultaneous starts create one active session; a later call creates a new session.
- Ending a permanent room's call leaves the definition available for the next call.
- Favorites and room lists are scoped to the current account; guessed IDs cannot reveal
  protected names, history or participants.
- Legacy room links, guest flow, invitations and streamer mode keep working.
- Archived definitions, deleted owners and entitlement changes have explicit server rules.

Test constraints, session association, webhook mapping, backfill and account authorization
with Postgres. Cover repeated calls, stable links, archive and favorites in E2E. Include
duplicate/out-of-order webhooks and account export/deletion for the new records.

## Phase 6 Team workspace

Estimate: 8–12 working days.

Add `features/team/` and explicit `/times` and `/times/:id` routes with loaders and actions.
Reuse participant accounts for membership and keep platform admin authentication separate.
Deliver team creation/settings, member management, link invitations, permanent team rooms
and session history. Show date, duration, participant count and sharing count in history;
expose neither chat contents nor platform-only IP/audit fields to the team UI.

| Team role | Capabilities                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| Owner     | Manage the team, roles and rooms; view beta entitlement; transfer ownership or delete the team |
| Manager   | Manage rooms and member invitations/removal; cannot remove the owner or change ownership       |
| Member    | Discover and join permitted team rooms; view team session summaries                            |
| Guest     | Join a specifically invited active call; receives no workspace/history access                  |

The owner and managers can acquire/transfer host authority for team calls. Other members
can start a call and become host only when its configured room policy allows it. Make
team-only access the default; offer guests by link as an explicit room setting. An
invitation never bypasses admission locking or an identity exclusion.

Create hashed, expiring, revocable team-invitation tokens bound to the intended email.
Require that the accepting account has verified that email, even when global room entry
verification is disabled. Acceptance is single-use and transactional. The first version
lets a manager copy an invitation link for sharing. Automatic invitation email delivery
is a later extension. Keep room invites and team invites distinct because their access
and redemption rules differ.

Scope every query and mutation to current membership and capability; each child loader
authorizes its own data. Prevent removal/demotion of the last owner. Removing a member
blocks future admission and schedules removal from active team calls, subject to the
transport boundary already established. On account deletion, remove memberships and
favorites; archive solely owned personal rooms. Offer ownership transfer first for a sole
team owner, and define team deletion explicitly if they proceed without a successor.

Extend beta entitlements and allowances to team ownership, provisioned through a platform admin
operation with audit. Deactivation keeps history readable to remaining authorized members,
blocks new Pro room creation and allows an already active call to end normally. Recheck
membership/entitlement at action time so stale loaders cannot authorize new operations.

Acceptance criteria:

- A member of team A cannot read or mutate team B by changing a URL or request ID.
- Invites fail when expired, revoked, already used or accepted by a different email.
- Owner/manager/member actions match the matrix and cannot remove the last owner.
- Removed members lose workspace access immediately and media removal follows the tested
  transport behavior.
- Multiple calls in one permanent room appear as distinct history entries.
- Personal export, deletion and the existing retention jobs account for team records.
- Beta entitlements cannot be self-granted or bypassed through direct action requests.

Use Postgres tests for role checks, concurrent invitation redemption, owner invariants and
history scoping. E2E should cover two teams, each role, a guest, a revoked invite and an
entitlement change during an open page.

Release C is ready after phases 5–6: an additional 13–19 working days before contingency.

## Data model and migration sequence

| Record                                 | Purpose                                                                    | First required  |
| -------------------------------------- | -------------------------------------------------------------------------- | --------------- |
| `room_definitions`                     | Public code, kind, name, owner, optional team and archive state            | Host controls   |
| `room_sessions`                        | One call, media name/SID, host, admission policy, lifecycle and timestamps | Host controls   |
| `room_session_members`                 | Reservations, admissions and identity exclusions per session               | Host controls   |
| `room_commands`                        | Pending/applied/failed transport operations and retry state                | Host controls   |
| Session links on participation records | Associate people and shares with a specific call                           | Permanent rooms |
| `room_favorites`                       | Unique account and room association                                        | Permanent rooms |
| `teams` and `team_members`             | Team ownership and role membership                                         | Team workspace  |
| `team_invitations`                     | Hashed token, email, expiry, redemption and revocation                     | Team workspace  |
| `pro_entitlements`                     | Audited beta capabilities and limits for a pilot account or team           | Permanent rooms |

Add tables and nullable associations first, with runtime-role grants, indexes and foreign
keys. Deploy compatible reads/writes, backfill deterministically and validate constraints
before tightening required columns. Map new media room names to public codes on the server;
browser URLs remain stable. Legacy webhook projection must remain compatible during
rollout, and changing an internal name must not create a second public room by accident.

Treat recorded permissions as the source of authority. Webhooks update presence and
history; delayed events cannot reinstate revoked membership, host authority or a closed
session. Extend anonymization and retention to the new records in the same feature PRs.
Make transport retries idempotent and observable. Document rollback for both additive
schema changes and calls already using the new media naming scheme.

## Pull request breakdown

Each numbered item is a proposed independently reviewable PR, not a created branch or PR.
Keep the repository's theme branches, English Conventional Commits and separate formatting
commits if formatting touches unrelated code.

1. Room definition/session ADR and admission feasibility results.
2. Individual audio controls and lifecycle tests.
3. Sharing profile mapping, menu and compatibility checks.
4. Session authority schema, creation and admission policies, with their tests.
5. Host operations, durable transport commands and audit.
6. Host menus, transfer, reconnect behavior and moderation E2E.
7. Annotation protocol, stage tools and multi-client tests.
8. Permanent room lifecycle, webhook mapping and migration/backfill.
9. My rooms, favorites and permanent-room navigation.
10. Team schema, membership operations and authorization.
11. Team invitations and ownership lifecycle.
12. Team room integration, history and beta entitlements.
13. Release validation fixes, documentation and user-facing release notes.

Backend prerequisites can merge before their UI when existing entry flows stay compatible.
Keep authorization tests with the operations they protect. Before each push, fetch and
rebase onto `origin/main`; CI must pass before merge.

## Phase 7 Release validation and rollout

Estimate: 3–5 working days across the releases.

For every implementation PR, run `pnpm format` at the repository root after editing and
before final checks, then `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
and `pnpm build`. Run the relevant Playwright flows with Postgres and LiveKit, and the
full E2E suite for each release candidate. Confirm that integration tests actually run;
missing database configuration is not a successful integration check. Complete the other
required CI checks, including Knip, duplication and dependency audit.

Validate audio/image features on supported Chrome/Edge, Firefox and Safari desktops using
the existing browser capability matrix. Verify mobile joining, responsive controls,
keyboard access, fullscreen, navigation during calls and streamer mode. Native capture
and audio behavior also need a manual real-device pass.

Use the existing room limit for initial media load checks, with two concurrent shares and
multiple annotators. Measure CPU, memory, bitrate, packet loss and join latency against
phase 0. Test team/history pagination and tenant indexes with generated data. Larger Pro
rooms need their own capacity test before raising the server-enforced limit.

Release A and B to a small pilot first; release C to selected teams with manual beta
entitlements. Keep an operational path to stop new use of a feature while preserving
existing room joins. Ship release notes and update README/features/pricing only when the
corresponding behavior is available. Monitor errors, join failures, failed transport
commands and database/migration performance during rollout.

## Success measures and first execution step

Establish a baseline before release, then evaluate:

| Release                   | Measure                                                                                         | Evaluation                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Audio and profiles        | Successful screen-share starts; audio/profile usage; echo and playback reports                  | No regression in join/share success, and fewer pilot complaints                |
| Host and annotations      | Successful moderation commands; failed authorization attempts; calls using annotations          | Operations follow their tested guarantees and markers remain useful under load |
| Permanent rooms and teams | Weekly returning creators; repeated sessions per saved room; accepted invitations; active teams | Compare repeat usage before and after the pilot                                |

Choose numerical adoption targets after collecting the baseline. Use aggregate counters
or sampled events without message contents, drawings or email addresses; setting a slider
must not create a stream of permanent tracking events. Ask pilot users for feedback on
the controls and whether permanent rooms reduce the work of starting their next call.

Begin with phase 0 and the individual-audio PR. Finish release A before building the
authority model, then complete release B and the team beta in dependency order. The first
checkpoint is a reviewed audio/profile release with working integration and E2E evidence;
the next checkpoint is a measured, documented admission guarantee for host controls.
