function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("name" in error)) return undefined;
  return typeof error.name === "string" ? error.name : undefined;
}

export function microphonePermissionDenied(error: unknown): boolean {
  const name = errorName(error);
  return name === "NotAllowedError" || name === "PermissionDeniedError";
}

/** Native capture errors are understood without downloading the call SDK. */
export function micErrorMessage(error: unknown): string {
  switch (errorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "O navegador bloqueou o microfone.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Nenhum microfone encontrado. Conecte um microfone ou fone com microfone.";
    case "NotReadableError":
    case "TrackStartError":
      return "O microfone está em uso por outro programa. Feche o programa e tente de novo.";
    default:
      return "Não deu para usar o microfone. Confira se ele está conectado e tente de novo.";
  }
}

/** Microphone failure inside the room: a blocked microphone needs the site settings, not a retry. */
export function roomMicErrorMessage(error: unknown): string {
  if (microphonePermissionDenied(error)) {
    return "O navegador bloqueou o microfone. Libere o acesso nas configurações deste site e tente ligá-lo de novo.";
  }
  return micErrorMessage(error);
}
