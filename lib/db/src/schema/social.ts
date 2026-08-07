import { pgTable, serial, integer, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { storiesTable } from "./stories";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: integer("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isFriend: boolean("is_friend").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  followerFollowingIdx: uniqueIndex("follows_follower_following_idx").on(table.followerId, table.followingId),
}));

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
  storyId: integer("story_id").references(() => storiesTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationMembersTable = pgTable("conversation_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"),
  muted: boolean("muted").default(false).notNull(),
}, (table) => ({
  memberIdx: uniqueIndex("conversation_members_member_idx").on(table.conversationId, table.userId),
}));

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").default("text").notNull(),
  body: text("body").default("").notNull(),
  mediaUrl: text("media_url"),
  durationMs: integer("duration_ms"),
  deliveredAt: timestamp("delivered_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
