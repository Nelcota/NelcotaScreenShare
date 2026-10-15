/** Which sessions "Encerrar" is about to end: one device, or every other one. */
export type SessionEnd =
  | { kind: "one"; sessionId: string; device: string }
  | { kind: "others"; count: number };

/** The question before ending sessions: who gets signed out, and that this one stays. */
export function sessionEndConfirmation(end: SessionEnd) {
  if (end.kind === "one") {
    return {
      title: "Encerrar esta sessão?",
      description: `${end.device} sai da sua conta e precisa entrar de novo.`,
      confirmLabel: "Encerrar",
    };
  }
  return {
    title:
      end.count === 1 ? "Encerrar a outra sessão?" : `Encerrar as ${end.count} outras sessões?`,
    description: "Os outros dispositivos saem da sua conta. Este continua conectado.",
    confirmLabel: "Encerrar",
  };
}
