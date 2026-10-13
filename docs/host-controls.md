# Host authority and controls

The host-controls implementation is opt-in with `ROOM_HOST_CONTROLS_ENABLED=true`.
Apply migration `0012_room_host_controls` first. The default remains false while the
existing public LiveKit signaling topology is in use. No production deployment is
performed by this change.

## Behavior

The first authorized participant account atomically claims a pending call before receiving
its token. Concurrent requests share one session and host. Guests cannot create or become
host. Pending reservations expire after 60 seconds; reservations count toward capacity
but do not count as admission. A session has its own internal LiveKit name.

The host badge comes from server state. The crown menu locks new entrants, selects screen
sharing policy (Everyone, Host, Specific people), and closes the room for everyone. The
people list offers transfer to another connected account and removal, with confirmation.

Saved room roles ([ADR 0007](adr/0007-room-ownership-and-host.md)) extend this authority.
The room owner may give every host command without holding the host role, and becomes host
once connected and admitted. A moderator is a co-host: lock, sharing policy and removal of
participants, but not transfer, closing, or removing the host, the owner or another
moderator. The control state lists the commands each person may give; menus show only those.
A transfer given by the owner also hands over the room: the target becomes owner and the
former owner a moderator. The owner does this from the person's card ("Transferir a sala").
Sync commands also publish each person's saved room role, so badges follow the change.

The person's card keeps two actions for the owner and moderators. "Expulsar" disconnects
without excluding: the person may rejoin. "Banir desta chamada" is the session exclusion,
recorded with who did it (`excluded_by_user_id` or, from the admin panel,
`excluded_by_admin_id`), followed by a durable `remove` command. With the flag off there is
no session; bans stay in `room_bans` for the LiveKit call. The admin panel reads both through
`listCallRemovals` and lifts a ban with `readmitToSession`
(`features/room/server/call-removals.server.ts`); the panel audits the change.
Screen and screen-audio permissions change together; microphone and data permissions remain.
LiveKit removes already published tracks of revoked sources. See its
[SetPermission implementation](https://github.com/livekit/livekit/blob/v1.13.7/pkg/rtc/participant.go).

Locks allow identities already admitted through the signaling gate to reconnect, unless
excluded. A prefetched token alone does not confer this exception. Removal excludes an
identity from this session. A guest who clears their signed cookie can obtain another
identity; locking new entrants supplies the room-level control. Closing from the host menu
makes the public code terminal only for an ad hoc room without an owner. A room with an
owner, a permanent room or a team room keeps its code for a new call. A naturally empty
call expires after 60 seconds, keeping the definition available for a new call with a new
internal media name.

The host retains authority for 60 seconds after disappearing. After that, the connected,
admitted, nonexcluded active accounts are ranked: the owner, then moderators, then everyone
else, each group by join time. The first becomes host. Guests alone cannot claim
authority and new admission stays locked. Presence checks use the LiveKit service API;
webhooks project history and never grant roles. Calls persist when navigating within the app.

Host policy, a durable transport command and audit commit atomically. Transport effects
follow the commit. Failures stay visible and retry every five seconds with bounded
backoff; retries apply current policy to the original session. An unavailable media server
can delay disconnecting existing transports. The UI reports that the policy was saved and
the effect awaits retry. Exclusions and closure still prevent admission once policy commits.

Admission/exclusion records and command history for closed calls are purged after 183 days.
Session history keeps its identifiers, with old host/allowed-person references cleared.
Account export includes owned definitions and admissions. Anonymization detaches ownership
and host links and excludes the account's membership. No screen/audio/chat content is stored.

## Required deployment boundary

Self-hosted LiveKit does not revoke already issued JWTs when a participant is removed or
a room deleted. The app relays binary WebSocket signaling at
`APP_URL/api/sala/conexao/rtc` and `/rtc/v1`. Every handshake verifies the JWT and current
database membership, lock, exclusion and session state, then signs upstream credentials
with current source permissions. The room lock is held through upstream establishment and
admission. Cached and LiveKit-refreshed tokens cannot bypass this gate **only if direct
signaling is inaccessible to clients**. Media continues directly over RTC/TURN ports.

Before enabling in Coolify:

1. Drain legacy calls. Apply migrations with the migrator role and deploy this application.
2. Configure a private upstream reachable from the app, such as
   `LIVEKIT_URL=ws://host.docker.internal:7880`. Add the host gateway mapping to the app
   container if that hostname is unavailable. Allow only the app's trusted network to 7880.
3. Remove the public `lk.*` HTTP/HTTPS Traefik routers from the legacy deployment guide,
   including alternate domains, paths and direct port mappings. Deny public TCP 7880 at
   both host and provider firewalls. A private hostname in configuration alone proves
   nothing about reachability. Keep RTC 7881/TCP, configured RTP UDP and TURN ports available.
   The TURN DNS name may remain; it must not proxy public HTTP signaling to 7880.
4. Ensure the app's HTTPS proxy supports WebSocket upgrades at the new path. Disable
   query-string logging on that path at every proxy: signaling queries contain JWTs.
5. Set `ROOM_HOST_CONTROLS_ENABLED=true` and restart the app. The environment validator
   rejects public upstream hostnames. Use one application replica; relay connection
   teardown is process-local, while database authority and SDK effects are serialized.
6. From an external client, verify all direct signaling URLs/ports are unreachable.
   Verify app admission and attempt reentry with original and server-refreshed credentials
   after removal, locking and closure. Repeat on the actual VPS before rollout.

The repository's legacy Compose/proxy examples stay usable with the flag off. They do not
establish the required private boundary. Do not activate host controls by merely changing
the flag against those examples. For rollback, drain controlled calls first and leave the
private boundary in place; exposing direct signaling would revive outstanding credentials.

## Local verification

Run the regular unit/integration tests with disposable Postgres. For browser transport
verification, start development LiveKit and run:

```bash
E2E_HOST_CONTROLS=true pnpm test:e2e tests/e2e/host-controls.spec.ts
```

This uses a disposable E2E database and the application gate, including original/refreshed
JWT attempts, transfer, lock, restriction, removal and terminal closure. Loopback-only
LiveKit in local tests is a functional test fixture, not evidence of production firewall
configuration. The ordinary Chromium suite remains available with the flag off.
