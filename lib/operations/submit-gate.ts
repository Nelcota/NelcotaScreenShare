/**
 * A synchronous "already sending" flag. React state only changes on the next render, so a
 * double click reaches the handler twice before `isPending` is true; this does not.
 */
export function createSubmitGate() {
  let busy = false;
  return {
    /** True when this submit may go; false while another is on its way. */
    enter(): boolean {
      if (busy) return false;
      busy = true;
      return true;
    },
    release(): void {
      busy = false;
    },
  };
}
