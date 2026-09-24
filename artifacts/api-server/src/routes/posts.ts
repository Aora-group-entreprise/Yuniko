import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  eq,
  gt,
  insertRow,
  selectRows,
  supabaseError,
  updateRows,
  deleteRows,
} from "../lib/supabase";

const postsRouter = Router();
const FEED_LIMIT = 50;
const FEED_CANDIDATE_LIMIT = 250;
const FEED_MINIMUM_RESULTS = 15;
const FEED_STAGES = [3, 5, 7] as const;

type FeedPostRow = Record<string, any> & {
  id: number;
  userId: number;
  authorCountry: string | null;
};

function normalizeCountry(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function feedQuality(rows: FeedPostRow[]) {
  return rows.length >= FEED_MINIMUM_RESULTS && new Set(rows.map((row) => row.userId)).size >= 3;
}

async function feedRows(viewerId: number) {
  const [posts, users, settings, following] = await Promise.all([
    selectRows("posts", {
      filters: [eq("isWorldFeed", true)],
      order: { column: "createdAt", ascending: false },
      limit: FEED_CANDIDATE_LIMIT,
    }),
    selectRows("users", { limit: 1000 }),
    selectRows("user_settings", { limit: 1000 }),
    selectRows("follows", { filters: [eq("followerId", viewerId)], limit: 5000 }),
  ]);
  const byId = new Map(users.map((user) => [Number(user.id), user]));
  const privateById = new Map(settings.map((row) => [Number(row.userId), Boolean(row.privateAccount)]));
  const followingIds = new Set(following.map((row) => Number(row.followingId)));
  return posts.filter((post) => {
    const authorId = Number(post.userId);
    return !privateById.get(authorId) || authorId === viewerId || followingIds.has(authorId);
  }).map((post) => {
    const author = byId.get(Number(post.userId));
    return {
      ...post,
      authorDisplayName: author?.displayName ?? null,
      authorUsername: author?.username ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      authorCountry: (author?.country as string | null) ?? null,
      authorPrivate: privateById.get(Number(post.userId)) ?? false,
    } as unknown as FeedPostRow;
  });
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

postsRouter.post("/posts", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const { caption, mediaUrl, location, hashtags, isWorldFeed } = req.body as {
    caption?: string;
    mediaUrl?: string | null;
    location?: string;
    hashtags?: string;
    isWorldFeed?: boolean;
  };
  if (!caption?.trim() && !mediaUrl) return res.status(400).json({ error: "Caption or photo required" });

  try {
    const post = await insertRow("posts", {
      userId: req.userId!,
      caption: caption?.trim() ?? "",
      mediaUrl: mediaUrl ?? null,
      location: location?.trim() || null,
      hashtags: hashtags?.trim() || null,
      isWorldFeed: isWorldFeed ?? true,
    });
    return res.status(201).json({ post });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.get("/posts/mine", authMiddleware, async (req: Request & { userId?: number }, res) => {
  try {
    const posts = await selectRows("posts", {
      filters: [eq("userId", req.userId!)],
      order: { column: "createdAt", ascending: false },
      limit: 100,
    });
    return res.json({ posts });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.get("/posts/feed", authMiddleware, async (req: Request & { userId?: number }, res) => {
  try {
    const [[viewer], candidates] = await Promise.all([
      selectRows("users", { select: "country", filters: [eq("id", req.userId!)], limit: 1 }),
      feedRows(req.userId!),
    ]);
    const availableCountries = Array.from(
      candidates.reduce((counts, row) => {
        const country = normalizeCountry(row.authorCountry);
        if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    ).sort(([, a], [, b]) => b - a).map(([country]) => country);
    const viewerCountry = normalizeCountry(viewer?.country as string | null | undefined);
    const rankedCountries = [...(viewerCountry ? [viewerCountry] : []), ...availableCountries.filter((country) => country !== viewerCountry)];

    let selectedRows = candidates.slice(0, FEED_LIMIT);
    let selectedCountries: string[] = [];
    let feedMode: "countries" | "world" = "world";
    for (const stageSize of FEED_STAGES) {
      const countries = rankedCountries.slice(0, stageSize);
      if (countries.length === 0) break;
      const countrySet = new Set(countries);
      const stageRows = candidates.filter((row) => countrySet.has(normalizeCountry(row.authorCountry) ?? "")).slice(0, FEED_LIMIT);
      selectedRows = stageRows;
      selectedCountries = countries;
      if (feedQuality(stageRows)) {
        feedMode = "countries";
        break;
      }
    }
    if (feedMode === "world" && !feedQuality(selectedRows)) {
      selectedRows = candidates.slice(0, FEED_LIMIT);
      selectedCountries = [];
    }

    const [likes, saves] = await Promise.all([
      selectRows("likes", { select: "post_id", filters: [eq("userId", req.userId!)] }),
      selectRows("saves", { select: "post_id", filters: [eq("userId", req.userId!)] }),
    ]);
    const likedIds = new Set(likes.map((row) => Number(row.postId)));
    const savedIds = new Set(saves.map((row) => Number(row.postId)));
    const sinceValue = typeof req.query["since"] === "string" ? req.query["since"] : null;
    const sinceDate = sinceValue ? new Date(sinceValue) : null;
    const newPostsCount = sinceDate && !Number.isNaN(sinceDate.getTime())
      ? (await selectRows("posts", { filters: [eq("isWorldFeed", true), gt("createdAt", sinceDate)] })).length
      : 0;

    return res.json({
      posts: selectedRows.map((row) => serializeFeedPost(row, likedIds, savedIds)),
      newPostsCount,
      latestCreatedAt: candidates[0]?.createdAt ?? null,
      scope: {
        mode: feedMode,
        countries: selectedCountries,
        countryCount: selectedCountries.length,
        label: feedMode === "world" ? "world" : `${selectedCountries.length} countries`,
      },
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.get("/posts/feed/updates", authMiddleware, async (req, res) => {
  const sinceValue = typeof req.query["since"] === "string" ? req.query["since"] : null;
  const sinceDate = sinceValue ? new Date(sinceValue) : null;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) return res.json({ newPostsCount: 0 });
  try {
    const rows = await selectRows("posts", { filters: [eq("isWorldFeed", true), gt("createdAt", sinceDate)] });
    return res.json({ newPostsCount: rows.length });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.get("/posts/:postId", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await selectRows("posts", {
      filters: [eq("id", postId)],
      limit: 1,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    const [author, like, save] = await Promise.all([
      selectRows("users", { filters: [eq("id", Number(post.userId))], limit: 1 }),
      selectRows("likes", { filters: [eq("postId", postId), eq("userId", req.userId!)], limit: 1 }),
      selectRows("saves", { filters: [eq("postId", postId), eq("userId", req.userId!)], limit: 1 }),
    ]);
    return res.json({
      post: {
        ...post,
        authorDisplayName: author[0]?.displayName ?? null,
        authorUsername: author[0]?.username ?? null,
        authorAvatarUrl: author[0]?.avatarUrl ?? null,
      },
      liked: like.length > 0,
      saved: save.length > 0,
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.delete("/posts/:postId", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await selectRows("posts", {
      select: "id,userId",
      filters: [eq("id", postId)],
      limit: 1,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (Number(post.userId) !== Number(req.userId)) return res.status(403).json({ error: "You can only delete your own posts" });
    // Remove every server-side trace before deleting the post row.
    await Promise.all([
      deleteRows("likes", [eq("postId", postId)]),
      deleteRows("saves", [eq("postId", postId)]),
      deleteRows("shares", [eq("postId", postId)]),
      deleteRows("post_engagements", [eq("postId", postId)]),
      deleteRows("comments", [eq("postId", postId)]),
      deleteRows("notifications", [eq("postId", postId)]),
      deleteRows("post_edits", [eq("postId", postId)]),
      deleteRows("post_media", [eq("postId", postId)]),
      deleteRows("events", [eq("postId", postId)]),
      deleteRows("post_stats", [eq("postId", postId)]),
      deleteRows("post_distribution", [eq("postId", postId)]),
      deleteRows("seen_posts", [eq("postId", postId)]),
    ]);
    await deleteRows("posts", [eq("id", postId), eq("userId", req.userId!)]);
    const traceTables = ["likes", "saves", "shares", "post_engagements", "comments", "notifications", "post_edits", "post_media", "events", "post_stats", "post_distribution", "seen_posts"];
    const [remainingPost, remainingTraces] = await Promise.all([
      selectRows("posts", { select: "id", filters: [eq("id", postId)], limit: 1 }),
      Promise.all(traceTables.map((table) => selectRows(table, { select: "post_id", filters: [eq("postId", postId)], limit: 1 }))),
    ]);
    if (remainingPost.length || remainingTraces.some((rows) => rows.length > 0)) {
      return res.status(500).json({ error: "Post deletion could not be verified" });
    }
    return res.json({ deleted: true, id: postId });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default postsRouter;