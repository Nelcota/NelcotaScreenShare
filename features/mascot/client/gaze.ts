import { gazeAt, IDLE, type Gaze, type Point } from "@/features/mascot/domain/eye-tracking";
import type { Expression } from "@/features/mascot/domain/face";
import type { GazeFocus } from "@/features/mascot/domain/rules";

/** Turns the face away while the password is being typed. */
const LOOK_AWAY: Gaze = {
  x: -0.95,
  y: -0.75,
  leftX: -0.95,
  leftY: -0.75,
  rightX: -0.95,
  rightY: -0.75,
};
/** Fields with typeable text: without a mouse position, the gaze follows the text caret. */
const TEXT_INPUT_TYPES = new Set(["text", "email", "password", "search", "tel", "url"]);

const measure = typeof document === "undefined" ? null : document.createElement("canvas");

/**
 * Gaze of the face (`face`) towards a point on the screen. Mirrored mascot
 * (`facing="right"`): aims at the point reflected across the face's axis, and the drawing's
 * mirroring brings the gaze back to the right point.
 */
function lookAt(face: Element, point: Point): Gaze {
  const rect = face.getBoundingClientRect();
  const mirrored = face.closest("[data-facing='right']") !== null;
  const target = mirrored ? { x: 2 * rect.left + rect.width - point.x, y: point.y } : point;
  return gazeAt(rect, target);
}

function center(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Point in the typed text where the caret is (or the end of the text). */
function caretPoint(input: HTMLInputElement): Point {
  const rect = input.getBoundingClientRect();
  const style = getComputedStyle(input);
  let width = 0;
  const context = measure?.getContext("2d");
  if (context) {
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let end = input.value.length;
    try {
      end = input.selectionEnd ?? end;
    } catch {
      // type="email" does not expose the selection: use the end of the text.
    }
    width = context.measureText(input.value.slice(0, end)).width;
  }
  const x = Math.min(
    rect.left + parseFloat(style.paddingLeft) + width - input.scrollLeft,
    rect.right - parseFloat(style.paddingRight),
  );
  return { x, y: rect.top + rect.height * 0.62 };
}

/** Focused password field (hidden or, with "Mostrar senha", visible). */
function focusedPasswordField(): HTMLInputElement | undefined {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement)) return undefined;
  return active.type === "password" || active.autocomplete.includes("password")
    ? active
    : undefined;
}

/** Hidden password: eyes closed. Shown: peeks with one eye only (but not while asleep). */
export function passwordEyes(expression: Expression): readonly [number, number] | undefined {
  const field = focusedPasswordField();
  if (!field || expression === "asleep") return undefined;
  return field.type === "password" ? [1, 1] : [1, 0];
}

/** The other mascot of the pair (walking or greeting, they look at each other). */
function pairPartner(root: Element): Element | undefined {
  return [
    ...(root.closest("[data-mascot-pair]")?.querySelectorAll("[data-slot=mascot]") ?? []),
  ].find((other) => other !== root);
}

/** Element the expression asks to look at, when nothing asked for attention. */
export function focusTarget(root: Element, focus: GazeFocus): Element | undefined {
  if (focus === "partner") return pairPartner(root);
  if (focus === "stage") return document.querySelector("[data-mascot-stage]") ?? undefined;
  if (focus === "participants") {
    return document.querySelector("[data-mascot-participants]") ?? undefined;
  }
  return undefined;
}

/**
 * A signal takes priority over the mouse. Typing and focus discard the old pointer in the hook.
 * Passwords always avert the gaze, even when the pointer is over the field.
 */
export function gazeFor(
  face: Element,
  attention: Element | undefined,
  pointer: Point | null,
): Gaze {
  if (focusedPasswordField()) return LOOK_AWAY;
  if (attention?.isConnected) return lookAt(face, center(attention));
  if (pointer) return lookAt(face, pointer);
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(active.type)) {
    return lookAt(face, caretPoint(active));
  }
  // Free text (multiple lines): looks at the field, like someone following what is being written.
  if (active instanceof HTMLTextAreaElement) return lookAt(face, center(active));
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLButtonElement ||
    active instanceof HTMLAnchorElement
  ) {
    return lookAt(face, center(active));
  }
  return IDLE;
}
