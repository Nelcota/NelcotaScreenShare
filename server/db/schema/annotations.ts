import { integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { roomSessions } from "./room-control";

/** Only the clearing epoch is durable. Drawings never enter the database. */
export const annotationEpochs = pgTable(
  "annotation_epochs",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => roomSessions.id, { onDelete: "cascade" }),
    trackSid: text("track_sid").notNull(),
    epoch: uuid("epoch").notNull(),
    revision: integer("revision").notNull().default(1),
    fingerprint: text("fingerprint").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.trackSid] })],
);
