import { useCallback, useSyncExternalStore } from "react";

/**
 * An empty element another feature leaves on its page (by id) for this one to fill through a
 * portal; followed as that page mounts and unmounts it. Null while inactive or absent.
 */
export function usePageSlot(id: string, active = true) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    [active],
  );
  const findSlot = () => (active ? document.getElementById(id) : null);
  return useSyncExternalStore(subscribe, findSlot, () => null);
}
