import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postLikesTable = pgTable(
  "post_likes",
  {
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);

export const postSavesTable = pgTable(
  "post_saves",
  {
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const followsTable = pgTable(
  "follows",
  {
    followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    followingId: integer("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.followerId, table.followingId] }),
  }),
);