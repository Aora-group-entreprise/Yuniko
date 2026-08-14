import { boolean, pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  privateAccount: boolean("private_account").default(false).notNull(),
  readReceipts: boolean("read_receipts").default(true).notNull(),
  messagePermission: text("message_permission").default("everyone").notNull(),
  commentPermission: text("comment_permission").default("everyone").notNull(),
  storyPermission: text("story_permission").default("friendsOnly").notNull(),
  hiddenPostIds: text("hidden_post_ids").default("[]").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
