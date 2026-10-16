import { useEffect, useRef, type RefObject } from "react";

/**
 * Sends the pre-join form once, as soon as it can go without the person: the same path as
 * clicking "Entrar na sala", so a failure stays on the pre-join with its message.
 */
export function useAutoJoin(form: RefObject<HTMLFormElement | null>, ready: boolean) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    form.current?.requestSubmit();
  }, [ready, form, sent]);
}
