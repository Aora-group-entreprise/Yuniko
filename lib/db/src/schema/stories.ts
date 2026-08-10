import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").default("image").notNull(),
  caption: text("caption").default("").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbStory = typeof storiesTable.$inferSelect;
export type InsertStory = typeof storiesTable.$inferInsert;
