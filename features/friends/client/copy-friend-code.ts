import { copyText } from "@/lib/clipboard";

/** Copies your friend code, with the toast saying whether it worked. */
export function copyFriendCode(code: string) {
  return copyText(code, {
    context: "Could not copy the friend code",
    success: "Código copiado.",
    failure: "Não foi possível copiar. Anote o código.",
  });
}
