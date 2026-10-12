import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { roomDefinitions } from "./room-control";
import { users } from "./user-auth";
import { createdAt } from "./columns";

export const roomFavorites = pgTable(
  "room_favorites",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => roomDefinitions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roomId] })],
);
