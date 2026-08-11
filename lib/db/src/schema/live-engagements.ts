import { pgTable, serial, integer, boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { liveSessionsTable } from "./live";

export const liveEngagementsTable = pgTable("live_engagements", {
  id: serial("id").primaryKey(),
  liveId: integer("live_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  liked: boolean("liked").default(false).notNull(),
  shared: boolean("shared").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  liveUserUnique: uniqueIndex("live_engagements_live_user_unique").on(table.liveId, table.userId),
}));

export const liveCommentsTable = pgTable("live_comments", {
  id: serial("id").primaryKey(),
  liveId: integer("live_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LiveEngagement = typeof liveEngagementsTable.$inferSelect;
export type LiveComment = typeof liveCommentsTable.$inferSelect;
