import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  caption: text("caption").default("").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("image").notNull(),
  mediaItems: text("media_items"),
  location: text("location"),
  hashtags: text("hashtags"),
  isWorldFeed: boolean("is_world_feed").default(true).notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  shares: integer("shares").default(0).notNull(),
  saves: integer("saves").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  reports: integer("reports").default(0).notNull(),
  viralScore: integer("viral_score").default(0).notNull(),
  distributionTier: integer("distribution_tier").default(0).notNull(),
  distributionCountries: text("distribution_countries").default("[]").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postEngagementsTable = pgTable(
  "post_engagements",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    liked: boolean("liked").default(false).notNull(),
    saved: boolean("saved").default(false).notNull(),
    shared: boolean("shared").default(false).notNull(),
    reported: boolean("reported").default(false).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    watchMs: integer("watch_ms").default(0).notNull(),
    completionRate: integer("completion_rate").default(0).notNull(),
    countriesSeeded: text("countries_seeded"),
    lastViewedAt: timestamp("last_viewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userPostIdx: uniqueIndex("post_engagements_user_post_idx").on(table.userId, table.postId),
  }),
);

export type DbPost = typeof postsTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type DbPostEngagement = typeof postEngagementsTable.$inferSelect;
