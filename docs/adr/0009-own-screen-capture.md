# ADR 0009 — Our own screen capture for window sound

- **Status:** accepted (2026-10-16).
- **Context:** a shared window, such as a game, always went without sound. Chromium 141 added `windowAudio` to `getDisplayMedia`. It lets the page offer sound when the person picks a window in the browser picker. The same release added `restrictOwnAudio`, which strips the page's own playback from the computer audio. LiveKit's `localParticipant.createScreenTracks` builds the `getDisplayMedia` options itself and does not forward `windowAudio` (checked up to `livekit-client` 2.22.4).

## Decision

- **`captureScreenTracks` replaces `createScreenTracks`** (`features/room/client/screen-capture.ts`). It calls `getDisplayMedia` with LiveKit's options plus `windowAudio`, and wraps the result as LiveKit tracks. Publishing, encoding and everything after the capture stay with LiveKit.
- **What we copy from LiveKit:**
  - The video constraints: an ideal size from the preset, or a maximum on Safari.
  - The options `audio`, `selfBrowserSurface`, `surfaceSwitching` and `systemAudio`.
  - A `LocalVideoTrack` with the `ScreenShare` source and its `contentHint`, plus a `LocalAudioTrack` with the `ScreenShareAudio` source when sound comes back. Both are SDK-managed (`userProvidedTrack: false`).
  - The playback unlock. LiveKit emits `AudioStreamAcquired` and the room calls `startAudio`; `useScreenShare` calls `room.startAudio()` after a capture with sound. A blocked playback only warns, since the room's "Ativar som" remains.
- **`windowAudio: "system"`, only next to `restrictOwnAudio`** (`computerAudioOptions`). A window goes with the same computer audio as a whole screen, minus the room, so nobody hears their own voice. The audio of the whole computer goes, not only the window's. `"window"` would send only the window's sound. It is left out because Chromium does not document it as implemented, and the echo check (`echoesRoomAudio`) relies on `restrictOwnAudio`. Where `restrictOwnAudio` is missing, neither a screen nor a window offers sound, as before.

## When to go back

Return to `createScreenTracks` when LiveKit forwards `windowAudio`, and its `AudioStreamAcquired` unlock then covers the playback again. Delete `screen-capture.ts`, its tests and `unlockRoomPlayback`, and pass `windowAudio` in the options `useScreenShare` already builds.

## Consequences

- A LiveKit upgrade that changes `createScreenTracks` must be compared with `captureScreenTracks`, so the two do not drift apart.
- Firefox and Safari do not send computer audio. The share menu still says so.
