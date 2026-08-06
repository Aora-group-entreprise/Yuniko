import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  caption: text("caption").default("").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("image"),
  location: text("location"),
  hashtags: text("hashtags"),
  isWorldFeed: boolean("is_world_feed").default(true).notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  shares: integer("shares").default(0).notNull(),
  saves: integer("saves").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbPost = typeof postsTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
