import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { callFriend, cancelCall } from "@/features/ringing/actions";
import { cancelCalling, ringFriend } from "@/features/ringing/client/calling";

vi.mock("@/features/ringing/actions", () => ({
  callFriend: vi.fn(),
  cancelCall: vi.fn(async () => ({ data: { cancelled: true } })),
}));
vi.mock("@/features/ringing/client/pending-call", () => ({ savePendingCall: vi.fn() }));

type Result = Awaited<ReturnType<typeof callFriend>>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.mocked(callFriend).mockReset();
  vi.mocked(cancelCall).mockClear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("cancelling before the response cancels the eventual server ring", async () => {
  const response = deferred<Result>();
  vi.mocked(callFriend).mockReturnValueOnce(response.promise);
  const pending = ringFriend({ friendId: "friend" });
  cancelCalling("friend", null);
  response.resolve({ data: { ringId: "late-ring", needsRoom: false } });
  expect(await pending).toBeNull();
  expect(cancelCall).toHaveBeenCalledWith({ ringId: "late-ring" });
});

test("cancelling after the response but before loader revalidation uses the returned ring", async () => {
  vi.mocked(callFriend).mockResolvedValueOnce({ data: { ringId: "known-ring", needsRoom: false } });
  await ringFriend({ friendId: "friend" });
  cancelCalling("friend", null);
  expect(cancelCall).toHaveBeenCalledWith({ ringId: "known-ring" });
});

test("a cancelled request that needs a room never opens it", async () => {
  const response = deferred<Result>();
  vi.mocked(callFriend).mockReturnValueOnce(response.promise);
  const openRoom = vi.fn();
  const pending = ringFriend({ friendId: "friend" }, openRoom);
  cancelCalling("friend", null);
  response.resolve({ data: { ringId: null, needsRoom: true } });
  expect(await pending).toBeNull();
  expect(openRoom).not.toHaveBeenCalled();
});

test("cancellation remains visible while room creation is in flight", async () => {
  vi.mocked(callFriend).mockResolvedValueOnce({ data: { ringId: null, needsRoom: true } });
  const created = deferred<void>();
  let activeAfterCreation: boolean | undefined;
  const pending = ringFriend({ friendId: "friend" }, async (active) => {
    await created.promise;
    activeAfterCreation = active();
  });
  await Promise.resolve();
  cancelCalling("friend", null);
  created.resolve();
  expect(await pending).toBeNull();
  expect(activeAfterCreation).toBe(false);
});

test("a late answer from a cancelled attempt cannot cancel a subsequent call", async () => {
  const first = deferred<Result>();
  const second = deferred<Result>();
  vi.mocked(callFriend).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const oldCall = ringFriend({ friendId: "friend", room: "abc-defg-hij" });
  cancelCalling("friend", null);
  const newCall = ringFriend({ friendId: "friend", room: "abc-defg-hij" });
  first.resolve({ data: { ringId: "old-ring", needsRoom: false } });
  second.resolve({ data: { ringId: "new-ring", needsRoom: false } });
  expect(await oldCall).toBeNull();
  expect((await newCall)?.data?.ringId).toBe("new-ring");
  expect(cancelCall).toHaveBeenCalledExactlyOnceWith({ ringId: "old-ring" });
  cancelCalling("friend", null);
  expect(cancelCall).toHaveBeenLastCalledWith({ ringId: "new-ring" });
});
