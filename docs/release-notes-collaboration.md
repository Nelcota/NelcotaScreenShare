# Collaboration pilot release candidate

These notes describe the implementation ready for review. They are not a record of a
production deployment. The public paid Pro launch, larger rooms and billing remain
separate work.

- Room audio now offers independent local voice and shared-sound volume/mute controls.
- Sharing profiles remember Automatic, Text, Video and Data saver on this browser.
- Hosts can lock admission, remove people, transfer authority, restrict screen sharing
  and end the call through the private signaling admission gate.
- Temporary arrows, circles and pen marks appear over the shared image with the author's
  name. They expire after ten seconds. Authors undo their marks; the presenter or host
  clears the screen. Keyboard and fullscreen are supported; native PiP shows video alone.
- `/salas` provides named personal rooms, stable links, favorites, archive and separate
  history for each call. Ending a permanent call preserves its link.
- `/times` provides roles, explicit guest admission, shared rooms, email-bound invitations
  and ownership transfer. Removed members lose workspace and reconnect access immediately.
- `/admin/pro` provisions personal/team pilot allowances with an audit entry. No automatic
  charges or invitation email are created.
- Account export and deletion include the workspace records. Sole team owners transfer
  ownership or explicitly confirm deleting their teams.

Deploy migrations 0013–0015 first. Keep collaboration disabled until the private LiveKit
boundary is validated, then select pilot accounts and teams. See
[collaboration workspaces](collaboration-workspaces.md) and [host controls](host-controls.md)
for permissions, limits, operational checks and rollback.
