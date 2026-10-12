# Collaboration workspaces and temporary annotations

Implemented locally on `feature/collaborative-room-workspaces`. Production rollout is
still gated by the private signaling boundary described in [host controls](host-controls.md).
Apply migrations 0013–0015 before running this build. The existing flag
`ROOM_HOST_CONTROLS_ENABLED=true` enables annotations and new permanent-room/team use.
The default remains false. Disabling it is not a safe mid-call rollback: drain controlled
calls before changing the transport mode.

## Temporary annotations

The screen stage offers arrows, circles and a pen. Choose a tool, drag on the image, or
use arrow keys and Enter to choose endpoints; Escape exits the tool. Drawing disables
the pointer tool. Marks include the actual LiveKit sender's label and expire after ten
seconds. Each author can undo their last mark. The current eligible host or the screen's
presenter can clear all marks, including a presenter joining as a signed guest.

Coordinates use the content rectangle of the video, excluding `object-contain` bars.
ResizeObserver and video metadata/resize events keep the SVG aligned through viewport and
fullscreen changes. Native picture-in-picture contains the video alone; the tool menu
states that it omits these annotations. A new viewer or reloaded client starts empty.

The versioned packet contains a call UUID, screen track SID, epoch UUID, mark UUID,
shape, timestamp and normalized points. Its schema rejects extra fields and unsupported
versions, coordinates and shapes. Clients enforce 6 KiB packets, 64 points per completed
mark, eight live marks per sender and 40 in total. Small previews are lossy and limited
to ten sends per second; completed marks and removals are reliable. Receivers separately
limit previews, completions and removals so a preview cannot suppress its completion.
Supplied names or host claims never grant authority.

Only epochs and revisions are stored in Postgres. An authenticated resource checks an
admitted, non-excluded identity and a currently published screen. Clearing rotates its
epoch under the room's authority lock and records an audit event without drawing
content. An unsigned server data notification prompts an authenticated reread, rather
than authorizing a clear. Polling every 1.5 seconds recovers a missing notification.
Older responses cannot overwrite a later revision. Canonical resolution changes and the
presenter's observed source/track-setting changes rotate epochs; changing or stopping
the focused screen discards local marks. Closed-call epochs follow the 183-day security
retention. No drawing coordinates or content are persisted or sent to telemetry.

## Permanent rooms and favorites

`/salas` lists owned personal rooms and rooms of current teams. Filters show active,
favorite and archived rooms. Creation, renaming, link copying, favorites, archive and
restoration are available according to the current server permissions. Favorites never
grant admission or access to history. All links keep their original public code.

Every call uses a separate `room_sessions` row and private media name. Closing a permanent
call closes only that session; the owner or an eligible team member can start another
call through the same link. Explicitly closing an ad-hoc room still makes its code
terminal. Only the personal room owner starts a personal call; guests enter an active
call when its explicit link policy allows it. Archive requires closing the active call
first, rejects new admission and preserves authorized history.

The beta has a default allowance of three active rooms per entitled subject. Platform
admins can set 1–50 rooms and an optional expiration at `/admin/pro`. An audited operation
requires `beta:update`; a participant account or viewer admin cannot grant access. Personal
and team entitlements are independent. Capacity counts and creation/restoration serialize
on a subject advisory lock. Admission and signaling acquire that lock before the room
lock, then reread canonical permissions. A credential reserved before deactivation cannot
start a new call after deactivation. Already active calls can finish normally; history,
renaming, archive and membership maintenance remain available.

## Team roles and invitations

`/times` lists current memberships. Personal Pro beta permits owning up to three teams;
each team needs its own entitlement for room creation, new starts and invitations.
The initial team cap is 100 members and 200 unredeemed, unrevoked, unexpired invitations.

| Capability                                                 | Owner                    | Manager | Member                                  |
| ---------------------------------------------------------- | ------------------------ | ------- | --------------------------------------- |
| Discover/join permitted team rooms; view history; favorite | Yes                      | Yes     | Yes                                     |
| Create/edit/archive rooms; rename the team                 | Yes                      | Yes     | No                                      |
| Invite/revoke; remove a non-owner                          | Yes                      | Yes     | No                                      |
| Change roles; transfer ownership; delete the team          | Yes                      | No      | No                                      |
| Start or assume host authority                             | Yes                      | Yes     | Only with the room's member-host policy |
| Leave voluntarily                                          | Transfer or delete first | Yes     | Yes                                     |

Team rooms default to members only. An explicit room setting allows link guests into an
active call. Owners and managers remain eligible hosts. Role loss is distinguished from
a lost connection: it triggers an immediate host election rather than the reconnection
grace. Every loader, action and cached-token signaling attempt reads current membership.
Workspace/history URLs reject a room belonging to a different team even when the account
belongs to both teams. Team history never contains IPs, chat or platform audit records.

Invitations use a 32-byte random base64url token, with only its SHA-256 digest in storage.
The complete link is shown once to copy and share; this version sends no invitation email.
It expires in seven days, is bound to the requested email and requires that email to be
verified even when global verification is disabled. Acceptance locks the team row and
rereads expiry, issuer role, revocation, prior use, membership, capacity and entitlement.
Concurrent redemption has one winner. Removing/demoting the issuer revokes their pending
invitations. The server redirects successful acceptance before revalidation would render
the consumed invitation as unavailable.

A partial unique index allows at most one owner per team. Deferred database constraint
triggers require exactly one owner for every active team at commit, permitting an atomic
transfer while preventing orphan teams. Team mutations serialize on the team row before
room/transport work. Removal commits membership loss and call exclusions together, then
applies durable media commands. Failed transport commands retry; excluded cached tokens
cannot reconnect while retrying. Team deletion archives its rooms and closes its calls.

## History, privacy and migrations

History pages show 50 calls at a time, using a timestamp/UUID cursor for stable ordering,
with indexes on definition/date/id and participation/session. They expose date, duration,
distinct admitted identities and screen-share totals. Admission increments a durable
participant count once per identity, so reconnections and removal do not inflate it and
security-record cleanup does not erase aggregate counts. Shares come from the authenticated,
idempotent webhook projection. Pending reservations are labeled not started. Missing
webhooks mean missing share history; operation and join success do not fabricate it.

Personal export includes owned-room metadata, favorites, memberships, invitation metadata
and personal beta activation, without token digests, invitation bearer tokens or other
members' contact details. Account deletion offers ownership transfer first; deleting owned
teams requires an explicit checkbox. It removes memberships, favorites and personal
entitlements, archives/redacts personal rooms, closes owned personal calls and excludes
the identity from remaining calls. Administrative deletion/anonymization refuses an
active sole owner until ownership is resolved. Blocking excludes current media without
discarding ownership. Expired, consumed or revoked invitation records are removed after
30 days; existing access-record retention stays unchanged.

0013 adds annotation epochs. 0014 adds workspaces, favorites, entitlements and nullable
room/session metadata, updated-at and deferred ownership triggers. Existing controlled
sessions receive only counts and first admission times derivable from their existing
members. Legacy definitions stay `ad_hoc`; webhook names and guessed creators are not
backfilled into permanent ownership or membership. 0015 adds history indexes. Migration
runtime grants use the existing migrator default privileges. The runtime role cannot
modify platform audit records or run DDL.

Roll back application use after draining calls and stopping new beta activations; keep
the additive tables. Older builds do not understand permanent-room access rules and
must not serve their codes through legacy public signaling. Never expose the private
LiveKit HTTP/WebSocket endpoint as an alternative to the application gate.

## Validation and pilot operations

Run the regular suite with the default flag, and the admission-specific Playwright suite
with `E2E_HOST_CONTROLS=true`. CI and local CI include host controls, annotations, workspaces
and the five-participant collaboration smoke case. Test Postgres is disposable and every
run migrates from scratch. Do not run separate E2E invocations concurrently against the
same `nelcota_e2e` database.

The collaboration smoke uses synthetic captures and microphones at the existing limit:
five participants, two concurrent screens and three annotators. Its Playwright attachment
records join latency and test conditions. This is a local functional capacity check,
not a production benchmark or evidence for larger Pro rooms. Real capture/audio on
Chrome/Edge, Firefox, Safari and mobile devices, production CPU/memory/bitrate/loss
baselines and a small pilot remain release gates. Keep the advertised room limit and
paid launch unchanged until those separate validations are complete.

Provision pilot accounts/teams only after migration and network checks. Watch join failures,
unexpected disconnects, failed/retrying room commands, invitation acceptance failures and
database latency through existing operations/audit and server diagnostics. Do not record
drawings, chat or recipient addresses as adoption telemetry. Drain calls before rollback,
retain readable authorized history, and compare pilot outcomes with a measured baseline.
