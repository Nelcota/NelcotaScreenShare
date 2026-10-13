import { beforeEach, expect, test, vi } from "vitest";
import { useChatState } from "@/features/room/hooks/use-chat-state";
import { encodeMessage } from "@/features/room/domain/data-channel";

interface Delivery {
  from?: { identity: string };
  payload: Uint8Array;
}

const capture = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  receive: undefined as ((message: Delivery) => void) | undefined,
  publish: vi.fn(async () => {}),
}));

vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = capture.cursor++;
    if (index >= capture.states.length)
      capture.states.push(typeof initial === "function" ? (initial as () => unknown)() : initial);
    return [
      capture.states[index],
      (next: unknown) => {
        capture.states[index] =
          typeof next === "function"
            ? (next as (value: unknown) => unknown)(capture.states[index])
            : next;
      },
    ];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useCallback: <T>(callback: T) => callback,
}));
// Chat notices listen for departures on the room; nothing leaves in these tests.
const fakeRoom = vi.hoisted(() => {
  const room = { on: () => room, off: () => room };
  return room;
});

vi.mock("@livekit/components-react", () => ({
  useChat: () => ({
    chatMessages: ["first", "second"].map((id) => ({
      id,
      message: id,
      timestamp: 1,
      from: { identity: "ana", name: "Ana", isLocal: false },
    })),
    send: vi.fn(),
    isSending: false,
  }),
  useLocalParticipant: () => ({ localParticipant: { identity: "local" } }),
  useRoomContext: () => fakeRoom,
  useDataChannel: (_topic: string, receive: (message: Delivery) => void) => {
    capture.receive = receive;
    return { send: capture.publish };
  },
}));
vi.mock("@/lib/hooks/use-shortcut-keys", () => ({ useRoomShortcut: () => {} }));
vi.mock("sonner", () => ({ toast: { dismiss: vi.fn() } }));

beforeEach(() => {
  capture.states = [];
  capture.cursor = 0;
  capture.receive = undefined;
  vi.clearAllMocks();
});

function ChatHarness() {
  return useChatState();
}

test("reliable edits delivered together are all applied, including edits followed by deletion", () => {
  ChatHarness();
  const receive = capture.receive;
  if (!receive) throw new Error("The data channel was not initialized.");
  const deliver = (op: unknown) =>
    receive({ from: { identity: "ana" }, payload: encodeMessage(op) });
  deliver({ type: "edit", id: "first", text: "corrected" });
  deliver({ type: "delete", id: "first" });
  deliver({ type: "delete", id: "second" });
  capture.cursor = 0;
  expect(ChatHarness().messages.map((message) => message.deleted)).toEqual([true, true]);
});

test("a sender cannot change another participant's messages", () => {
  ChatHarness();
  capture.receive?.({
    from: { identity: "bia" },
    payload: encodeMessage({ type: "delete", id: "first" }),
  });
  capture.receive?.({ payload: encodeMessage({ type: "delete", id: "second" }) });
  capture.cursor = 0;
  expect(ChatHarness().messages.map((message) => message.deleted)).toEqual([false, false]);
});
