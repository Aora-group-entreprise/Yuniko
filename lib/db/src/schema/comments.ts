import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => postsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
