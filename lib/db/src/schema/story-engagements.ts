import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storiesTable } from "./stories";

export const storyViewsTable = pgTable("story_views", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (table) => ({ uniqueView: uniqueIndex("story_views_story_user_idx").on(table.storyId, table.userId) }));

export const storyReactionsTable = pgTable("story_reactions", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ uniqueReaction: uniqueIndex("story_reactions_story_user_idx").on(table.storyId, table.userId) }));

export const storyRepliesTable = pgTable("story_replies", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
