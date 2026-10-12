# ADR 0006 Room definitions and session authority

- **Status:** accepted design (2026-10-12); server implementation belongs to the host-controls phase.
- **Context:** the feature roadmap adds host controls, permanent rooms and team history.
  Today, a public code is also the LiveKit room name. The webhook projection reopens the
  same `rooms` row, and `createdByUserId` is inferred from recent token requests.
  `hostPresent` only checks whether any account is connected. These projections cannot
  establish immediate host authority or represent separate calls behind a permanent link.

## Decision

Use a room definition for the public code, owner and settings, and a session for each
call. The public `/sala/:codigo` link stays stable. Each session gets a unique internal
media room name, its current host and its admission/sharing policies. The server maps
media names and SIDs back to definitions and sessions before processing webhooks.

During authorized session creation, claim initial host authority in a database transaction
before returning the media token. A per-definition lock and a unique active-session
constraint serialize concurrent starts. A guest cannot acquire host authority. Owner and
host are different roles: owning a permanent room does not require staying in every call.
Expire a pending session if its creator never connects, using the token/connection window
established when implementing that lifecycle.

Authorize each loader and action against current server state. LiveKit metadata can
announce capabilities to the UI but cannot grant them. Room webhooks update presence and
history, never membership or host authority. Add session links to participation records
without inventing session boundaries missing from legacy history.

Host commands persist policy changes, a pending transport command and audit in the same
database transaction. LiveKit side effects run after that commit. Record their outcomes
and reconcile failures through the existing maintenance lifecycle, using session IDs so
an old retry cannot affect a newer call. The UI reports success after the transport
operation succeeds and displays failures or pending work accurately.

## Admission experiment

On 2026-10-12, a disposable local LiveKit 1.13.7 container was exercised through its room
service API and the binary WebSocket signaling protocol with the installed server SDK.
The participant joined with a ten-minute JWT, had publishing revoked, was removed, and
then attempted admission with previously issued credentials. No application data or media
content was used in this experiment.

| Attempt                                                  | Observed result                               |
| -------------------------------------------------------- | --------------------------------------------- |
| Rejoin with the original JWT after removal               | Admitted                                      |
| Inspect permission on that original-token admission      | Original `canPublish: true` grant restored    |
| Rejoin with a server-refreshed JWT after removal         | Admitted                                      |
| Join with the original JWT after deleting the media room | Media room recreated and participant admitted |

These results measure signaling admission and granted permissions; they do not measure
actual media publication or a complete browser reconnect. They agree with LiveKit's
documented self-hosted behavior. Token revocation is Cloud-only, and connected clients
can receive refreshed tokens. [LiveKit token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/).

Application exclusions, admission locks and short JWT lifetimes protect new application
issuance. They do not invalidate an already issued JWT at the self-hosted media server.
A unique media name prevents an old session token from joining the next call, but does
not prevent reentry into its existing session. Identity exclusions also cannot recognize
a guest who clears their signed cookie.

The host-controls release must explicitly define the guarantee its deployment can enforce.
Strict immediate exclusion requires an enforceable transport admission/revocation
mechanism and its own implementation estimate. An HTTP policy check, a UI check or a
webhook that removes someone after joining cannot be described as immediate exclusion.
Keep self-hosted infrastructure for the current audio/image release; resolve the admission
gate before exposing host removal or lock claims to users.

## Audio and sharing foundation

Render each remote audio publication exactly once through a controlled `AudioTrack`.
Keep playback and local preferences inside the existing call lifetime, above hidden route
layouts. Key preferences by participant identity and voice/shared-audio source so track
replacement retains levels. Global deafening overrides gains without rewriting them and
preserves the existing microphone-restoration behavior. Dispose preferences when the
call ends; browser storage is unnecessary for individual listening levels.

Keep Automatic as the default sharing profile. Text requests the 1080p/15 fps preset and
a text content hint; Video requests 1080p/30 fps and motion; Data saver requests 720p/15 fps
and detail. Preserve the original surface-based Automatic mapping and audio echo checks.
Remember only the profile in a versioned browser preference, with a safe Automatic
fallback. These are capture targets subject to browser/network limits, not promised
received quality. Real-device readability and bandwidth comparisons remain a release
validation task.

## Consequences

- The audio/image implementation changes no room schema or existing admission contract.
- Room definitions and sessions will be added through compatible migrations with role
  grants, deterministic backfill and existing account export/deletion support.
- Team capabilities use participant accounts; they confer no platform-admin privileges.
- Old-token admission, concurrency, command retries and out-of-order webhooks are required
  test cases for the later server phases.
- Deployment rollback must account for sessions using the new media naming scheme.
