# ADR 0007 — Room ownership and the session host

- **Status:** accepted (2026-10-12).
- **Context:** two room models grew in parallel. The host controls of [ADR 0006](0006-room-definitions-and-session-authority.md) gave each call a session with one host who can lock, remove, transfer and close. Meanwhile "Criar sala" rooms kept a code in `room_codes` with an owner and moderators (`room_roles`) who persist across calls, plus kick, ban and entry with approval. Both decided who runs a call, and each had its own registry.

## Decision

- **One registry.** `room_definitions` holds every room. Migration 0021 moves each `room_codes` code over as an `ad_hoc` room. The owner is the `room_roles` owner, or else the creator. `room_codes` is dropped. `room_roles`, `room_settings` and `room_join_requests` point at `room_definitions.code`, because codes are never rewritten or reused. `owner_user_id` always matches the `room_roles` owner, and "Sala de <dono>" is derived from it.
- **Roles decide the host.** Owner and moderators are saved per room and outlive a call. When a session starts, or its host goes missing, the host is the owner if present, else the oldest moderator present, else the account ADR 0006 elects.
  - A personal room has no `room_roles` row for its owner: its `owner_user_id` counts as the owner when roles are read (`roomRoleOf`, `savedRolesIn`). The owner comes first in the election and takes the host back on return, as in any other room.
- **Moderator = co-host.** A moderator may lock, remove and choose who shares. Only the host or the owner may transfer or close. ADR 0006 has a single host; this is the only rule added to it.
- **"Transferir a sala"** makes the target the owner, and the former owner stays a moderator, in one transaction. The new owner then takes the host role as soon as they are admitted. A host transfer given by the owner also moves the room. Otherwise the owner, still present, would take the host back at once. A host who is not the owner transfers only the host role, as in ADR 0006.
- **Closing a call.** "Encerrar" ends the current session. A room with an owner in `room_roles` stays usable for the next call. Only an `ad_hoc` room with no owner closes its definition, as before.
- **Kick versus ban.** "Expulsar" drops the person from the call, and they may come back. "Banir desta chamada" keeps them out until the call ends.
  - With `ROOM_HOST_CONTROLS_ENABLED` on, banning is the session removal of ADR 0006 (`room_session_members.excluded_at` and who did it). The signaling relay enforces it on every handshake.
  - With the flag off there are no sessions. The ban stays in `room_bans`, keyed by the LiveKit room sid, with the same rules as before.
- **Lock and approval coexist.** Locking (host controls) closes the open session to newcomers. Entry with approval (`room_settings`) makes everyone but the owner and moderators ask first, in every call.
- **LiveKit names.** With the flag on, everything that addresses LiveKit maps the code to the session's media room through `mediaRoomForCode`: removal, role updates, photos, webhooks and the admin live view.
- **Per-person audio.** The host-controls engine stays: `RoomAudioProvider` plays each remote track once, with voice and shared-audio levels and a mute per person, and `ParticipantAudioMenu` keeps its place on the tile and in the people list. Our visual was adapted to it. The person's card and the shared screen's volume read the same state. The card's "Silenciar voz" lowers only the voice, keeping the shared screen audible. "Silenciar tudo" is the engine's mute, the same as "Silenciar só para mim" in the menu. Our separate player and its preferences were dropped, since two players would have played every track twice.

## Relation to ADR 0006

What stays:

- Definitions and sessions, the signaling relay as the admission gate, and the host commands committed with a transport command and audit.
- Exclusion per session and the 60-second grace for a missing host.
- `ROOM_HOST_CONTROLS_ENABLED` and its deployment boundary.

What changes:

- `room_definitions` also holds every "Criar sala" room. The host controls no longer register a code lazily on its first token.
- The initial host and the election after the grace prefer the owner, then moderators, before the oldest account.
- Moderators get the lock, removal and sharing commands.
- Closing keeps a room that has an owner.
- Transfer also changes the owner.
- The relay signs the saved room role into the upstream token, and sync commands publish it.
- Sync keeps the camera with the microphone.

## Consequences

- `room_bans` stays while production runs with the flag off. The signaling port must be private before the flag can be turned on (see [host controls](../host-controls.md)). Once the flag is on in production, a later change drops `room_bans` and the flag-off ban path.
- Deleting an account hands each owned room to its oldest moderator. With no moderator left, the room is deleted, or archived when sessions of it already exist, since `room_sessions` keeps history without a cascade.
- With the flag off, lock, sharing policy and transfer do not exist. "Transferir a sala" then only changes `room_roles` and `owner_user_id`.
