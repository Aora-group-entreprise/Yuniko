import { Router, Request } from "express";
import { db } from "@workspace/db";
import { postLikesTable, postSavesTable, postsTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const postsRouter = Router();
const FEED_LIMIT = 50;
const FEED_CANDIDATE_LIMIT = 250;
const FEED_MINIMUM_RESULTS = 15;
const FEED_STAGES = [3, 5, 7] as const;

function dbError(res: any, err: unknown) {
  if (!process.env["DATABASE_URL"]) {
    return res.status(503).json({
      error: "Database not configured. Please provision a database and set DATABASE_URL.",
    });
  }
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

type FeedPostRow = {
  id: number;
  userId: number;
  caption: string;
  mediaUrl: string | null;
  location: string | null;
  hashtags: string | null;
  isWorldFeed: boolean;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  createdAt: Date;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  authorCountry: string | null;
};

function normalizeCountry(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function feedQuality(rows: FeedPostRow[]) {
  if (rows.length < FEED_MINIMUM_RESULTS) return false;
  const distinctAuthors = new Set(rows.map((row) => row.userId)).size;
  return distinctAuthors >= 3;
}

function serializeFeedPost(row: FeedPostRow, likedIds: Set<number>, savedIds: Set<number>) {
  return {
    id: row.id,
    userId: row.userId,
    caption: row.caption,
    mediaUrl: row.mediaUrl,
    location: row.location,
    hashtags: row.hashtags,
    isWorldFeed: row.isWorldFeed,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    createdAt: row.createdAt,
    authorDisplayName: row.authorDisplayName,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    liked: likedIds.has(row.id),
    saved: savedIds.has(row.id),
  };
}

// POST /api/posts — create a post
postsRouter.post("/posts", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = req.userId!;
  const { caption, mediaUrl, location, hashtags, isWorldFeed } = req.body as {
    caption?: string;
    mediaUrl?: string | null;
    location?: string;
    hashtags?: string;
    isWorldFeed?: boolean;
  };

  if (!caption?.trim() && !mediaUrl) {
    return res.status(400).json({ error: "Caption or photo required" });
  }

  try {
    const [post] = await db
      .insert(postsTable)
      .values({
        userId,
        caption: caption?.trim() ?? "",
        mediaUrl: mediaUrl ?? null,
        location: location?.trim() || null,
        hashtags: hashtags?.trim() || null,
        isWorldFeed: isWorldFeed ?? true,
      })
      .returning();
    return res.status(201).json({ post });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/feed — get feed with author info
postsRouter.get("/posts/feed", authMiddleware, async (req: Request & { userId?: number }, res) => {
  try {
    const [viewer] = await db
      .select({ country: usersTable.country })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    const candidateRows = await db
      .select({
        id: postsTable.id,
        userId: postsTable.userId,
        caption: postsTable.caption,
        mediaUrl: postsTable.mediaUrl,
        location: postsTable.location,
        hashtags: postsTable.hashtags,
        isWorldFeed: postsTable.isWorldFeed,
        likes: postsTable.likes,
        comments: postsTable.comments,
        shares: postsTable.shares,
        saves: postsTable.saves,
        createdAt: postsTable.createdAt,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        authorCountry: usersTable.country,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.userId, usersTable.id))
      .where(eq(postsTable.isWorldFeed, true))
      .orderBy(desc(postsTable.createdAt))
      .limit(FEED_CANDIDATE_LIMIT) as FeedPostRow[];

    const availableCountries = Array.from(
      candidateRows.reduce((counts, row) => {
        const country = normalizeCountry(row.authorCountry);
        if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    )
      .sort(([, a], [, b]) => b - a)
      .map(([country]) => country);

    const viewerCountry = normalizeCountry(viewer?.country);
    const rankedCountries = [
      ...(viewerCountry ? [viewerCountry] : []),
      ...availableCountries.filter((country) => country !== viewerCountry),
    ];

    let selectedRows = candidateRows.slice(0, FEED_LIMIT);
    let selectedCountries: string[] = [];
    let feedMode: "countries" | "world" = "world";

    for (const stageSize of FEED_STAGES) {
      const countries = rankedCountries.slice(0, stageSize);
      if (countries.length === 0) break;
      const countrySet = new Set(countries);
      const stageRows = candidateRows
        .filter((row) => countrySet.has(normalizeCountry(row.authorCountry) ?? ""))
        .slice(0, FEED_LIMIT);

      if (feedQuality(stageRows)) {
        selectedRows = stageRows;
        selectedCountries = countries;
        feedMode = "countries";
        break;
      }

      selectedRows = stageRows;
      selectedCountries = countries;
    }

    if (feedMode === "world" && !feedQuality(selectedRows)) {
      selectedRows = candidateRows.slice(0, FEED_LIMIT);
      selectedCountries = [];
    }

    const postIds = selectedRows.map((row) => row.id);
    const [likes, saves] = postIds.length > 0
      ? await Promise.all([
          db.select({ postId: postLikesTable.postId }).from(postLikesTable)
            .where(eq(postLikesTable.userId, req.userId!)),
          db.select({ postId: postSavesTable.postId }).from(postSavesTable)
            .where(eq(postSavesTable.userId, req.userId!)),
        ])
      : [[], []];
    const likedIds = new Set(likes.map((row) => row.postId));
    const savedIds = new Set(saves.map((row) => row.postId));

    const sinceValue = typeof req.query["since"] === "string" ? req.query["since"] : null;
    const sinceDate = sinceValue ? new Date(sinceValue) : null;
    const hasValidSince = sinceDate && !Number.isNaN(sinceDate.getTime());
    const [newPostsResult] = hasValidSince
      ? await db
          .select({ count: count() })
          .from(postsTable)
          .where(and(eq(postsTable.isWorldFeed, true), gt(postsTable.createdAt, sinceDate!)))
      : [{ count: 0 }];
    const latestCreatedAt = candidateRows[0]?.createdAt ?? null;

    return res.json({
      posts: selectedRows.map((row) => serializeFeedPost(row, likedIds, savedIds)),
      newPostsCount: Number(newPostsResult?.count ?? 0),
      latestCreatedAt,
      scope: {
        mode: feedMode,
        countries: selectedCountries,
        countryCount: selectedCountries.length,
        label: feedMode === "world" ? "world" : `${selectedCountries.length} countries`,
      },
    });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/feed/updates?since=... — lightweight new-post check.
// It never changes the current feed, so scrolling can continue uninterrupted.
postsRouter.get("/posts/feed/updates", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const sinceValue = typeof req.query["since"] === "string" ? req.query["since"] : null;
  const sinceDate = sinceValue ? new Date(sinceValue) : null;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
    return res.json({ newPostsCount: 0 });
  }

  try {
    const [result] = await db
      .select({ count: count() })
      .from(postsTable)
      .where(and(eq(postsTable.isWorldFeed, true), gt(postsTable.createdAt, sinceDate)));
    return res.json({ newPostsCount: Number(result?.count ?? 0) });
  } catch (err) {
    return dbError(res, err);
  }
});

export default postsRouter;
