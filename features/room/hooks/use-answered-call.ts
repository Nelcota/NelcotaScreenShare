import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ANSWERED_CALL_PARAM } from "@/features/room/domain/answered-call";

/**
 * Whether the page opened from an accepted ring. Read once on arrival and taken out of the
 * address, so reloading or coming back later shows the pre-join as usual.
 */
export function useAnsweredCall(): boolean {
  const [params, setParams] = useSearchParams();
  const [answered] = useState(() => params.get(ANSWERED_CALL_PARAM) === "1");
  useEffect(() => {
    if (!params.has(ANSWERED_CALL_PARAM)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ANSWERED_CALL_PARAM);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [params, setParams]);
  return answered;
}
