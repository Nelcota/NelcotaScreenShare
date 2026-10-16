import { expect, test, vi } from "vitest";
import { pageSlot, pageSlotRef, subscribePageSlots } from "@/lib/page-slot";

const element = (name: string) => ({ name }) as unknown as HTMLElement;

test("a slot is known while its element is mounted, and listeners hear each change", () => {
  const onChange = vi.fn();
  const unsubscribe = subscribePageSlots(onChange);
  const ref = pageSlotRef("aviso");
  expect(pageSlotRef("aviso")).toBe(ref);

  const first = element("primeiro");
  const cleanup = ref(first);
  expect(pageSlot("aviso")).toBe(first);
  expect(onChange).toHaveBeenCalledOnce();

  cleanup?.();
  expect(pageSlot("aviso")).toBeNull();
  expect(onChange).toHaveBeenCalledTimes(2);
  unsubscribe();
});

test("an old element leaving does not drop the new one that took its place", () => {
  const ref = pageSlotRef("convite");
  const old = element("antigo");
  const fresh = element("novo");
  const cleanupOld = ref(old);
  ref(fresh);
  cleanupOld?.();
  expect(pageSlot("convite")).toBe(fresh);
});
