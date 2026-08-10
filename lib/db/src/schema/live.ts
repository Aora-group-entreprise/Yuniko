import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const liveSessionsTable = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  hostUserId: integer("host_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").default("").notNull(),
  streamUrl: text("stream_url"),
  status: text("status").default("live").notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export type LiveSession = typeof liveSessionsTable.$inferSelect;
