import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { deleteMessage } = await import("@/features/messages/actions.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const handler = (request: Request) => getUserAuth().handler(request);

async function reportedMessages() {
  const author = await verifiedParticipant(db, handler, { name: "Message author" });
  const reporter = await verifiedParticipant(db, handler, { name: "Message reporter" });
  const [low, high] = [author.id, reporter.id].toSorted();
  const [conversation] = await db
    .insert(schema.conversations)
    .values({ kind: "direct", directLowId: low, directHighId: high })
    .returning();
  await db.insert(schema.conversationMembers).values([
    { conversationId: conversation!.id, userId: author.id },
    { conversationId: conversation!.id, userId: reporter.id },
  ]);
  const messages = await db
    .insert(schema.messages)
    .values(
      ["First message", "Second message"].map((body) => ({
        conversationId: conversation!.id,
        authorId: author.id,
        body,
      })),
    )
    .returning();
  const reports = await db
    .insert(schema.reports)
    .values(
      messages.map((message) => ({
        reporterId: reporter.id,
        targetKind: "message" as const,
        targetUserId: author.id,
        targetConversationId: conversation!.id,
        targetMessageId: message.id,
        messageExcerpt: message.body,
        reason: "spam" as const,
      })),
    )
    .returning();
  return { author, reporter, messages, reports };
}

test("an author can delete two open reported messages in the same conversation", async () => {
  const { author, messages, reports } = await reportedMessages();
  const duplicate = { ...reports[0]! };
  delete (duplicate as Partial<typeof duplicate>).id;
  await expect(db.insert(schema.reports).values(duplicate)).rejects.toThrow();
  requestHeaders.current = new Headers({ cookie: author.jar.header() });
  for (const message of messages) {
    expect((await deleteMessage({ messageId: message.id })).data).toEqual({ deleted: true });
  }
  const retained = await db
    .select()
    .from(schema.reports)
    .where(
      inArray(
        schema.reports.id,
        reports.map((report) => report.id),
      ),
    );
  expect(retained).toHaveLength(2);
  expect(
    retained.every((report) => report.targetMessageId === null && report.status === "open"),
  ).toBe(true);
  expect(retained.map((report) => report.messageExcerpt)).toEqual(
    expect.arrayContaining(["First message", "Second message"]),
  );
});

test("account anonymization deletes multiple reported messages without an index collision", async () => {
  const { author, reports } = await reportedMessages();
  expect(await db.transaction((tx) => anonymizeParticipant(tx, author.id))).toBe(true);
  expect(
    await db.select().from(schema.messages).where(eq(schema.messages.authorId, author.id)),
  ).toEqual([]);
  const retained = await db
    .select()
    .from(schema.reports)
    .where(
      inArray(
        schema.reports.id,
        reports.map((report) => report.id),
      ),
    );
  expect(retained).toHaveLength(2);
  expect(
    retained.every((report) => report.targetMessageId === null && report.messageExcerpt === null),
  ).toBe(true);
});
