import { joinRoom, newParticipant, newRoomCode } from "./session";

/** Two people in one call with the chat open on both sides. */
export async function chatPair(
  browser: Parameters<typeof newParticipant>[0],
  names: [string, string],
  { recordBlobs = false } = {},
) {
  const sender = await newParticipant(browser, names[0]);
  const receiver = await newParticipant(browser, names[1]);
  // What the receiver builds from the bytes that arrived (the page's CSP blocks fetching blobs).
  if (recordBlobs) {
    await receiver.page.addInitScript(() => {
      const made: { size: number; type: string }[] = [];
      Object.assign(window, { madeBlobs: made });
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object: Blob | MediaSource) => {
        if (object instanceof Blob) made.push({ size: object.size, type: object.type });
        return original(object);
      };
    });
  }
  const code = await newRoomCode();
  await joinRoom(sender.page, code, { micOn: false });
  await joinRoom(receiver.page, code, { micOn: false });
  await sender.page.getByRole("button", { name: /^Chat/ }).click();
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  return {
    sender,
    receiver,
    senderChat: sender.page.getByRole("complementary", { name: "Chat da sala" }),
    receiverChat: receiver.page.getByRole("complementary", { name: "Chat da sala" }),
  };
}
