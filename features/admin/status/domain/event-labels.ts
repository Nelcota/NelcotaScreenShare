/** LiveKit webhook events in plain Portuguese; unknown ones show their raw name. */
const EVENT_LABELS: Record<string, string> = {
  room_started: "Sala aberta",
  room_finished: "Sala encerrada",
  participant_joined: "Entrada na sala",
  participant_left: "Saída da sala",
  participant_connection_aborted: "Conexão perdida",
  track_published: "Transmissão iniciada",
  track_unpublished: "Transmissão encerrada",
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}
