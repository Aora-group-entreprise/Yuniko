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
import { mixCandidateSources, rankFeedCandidates, type FeedRankingCandidate } from "../lib/feed-ranking";

const postsRouter = Router();
const FEED_LIMIT = 50;
const FEED_CANDIDATE_LIMIT = 2000;
const FEED_MINIMUM_RESULTS = 15;
const FEED_STAGES = [3, 5, 7] as const;

// Temporary launch safety net: keep the normal distribution/ranking algorithm intact,
// but make public world-feed posts globally eligible while Yuniko is still small.
// The mode disables itself once recent platform activity reaches all three thresholds.
// These can be overridden by Cloudflare Worker environment variables without a code change.
const COLD_START_MAX_ACTIVE_CREATORS = 500;
const COLD_START_MIN_POSTS = 2000;
const COLD_START_MIN_IMPRESSIONS = 100000;
const COLD_START_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function coldStartIsActive(posts: Array<Record<string, any>>, stats: Array<Record<string, any>>) {
  const cutoff = Date.now() - COLD_START_WINDOW_MS;
  const recentPosts = posts.filter((post) => new Date(String(post.createdAt ?? 0)).getTime() >= cutoff);
  const activeCreators = new Set(recentPosts.map((post) => Number(post.userId)).filter(Number.isInteger)).size;
  const recentPostIds = new Set(recentPosts.map((post) => Number(post.id)));
  const recentImpressions = stats.reduce((total, stat) => {
    const postId = Number(stat.postId);
    return recentPostIds.has(postId) ? total + Math.max(0, Number(stat.impressions) || 0) : total;
  }, 0);

  const creatorThreshold = envNumber("YUNIKO_COLD_START_ACTIVE_CREATORS", COLD_START_MAX_ACTIVE_CREATORS);
  const postThreshold = envNumber("YUNIKO_COLD_START_POSTS", COLD_START_MIN_POSTS);
  const impressionThreshold = envNumber("YUNIKO_COLD_START_IMPRESSIONS", COLD_START_MIN_IMPRESSIONS);

  return activeCreators < creatorThreshold || recentPosts.length < postThreshold || recentImpressions < impressionThreshold;
}

async function feedRows(viewerId: number) {
  const [posts, users, settings, following, blocked, stats, engagements, affinities, topics, distributions] = await Promise.all([
    selectRows("posts", { filters: [eq("isWorldFeed", true)], order: { column: "createdAt", ascending: false }, limit: FEED_CANDIDATE_LIMIT }),
    selectRows("users", { limit: 1000 }),
    selectRows("user_settings", { limit: 1000 }).catch(() => []),
    selectRows("follows", { filters: [eq("followerId", viewerId)], limit: 5000 }).catch(() => []),
    selectRows("blocked_users", { limit: 5000 }).catch(() => []),
    selectRows("post_stats", { limit: FEED_CANDIDATE_LIMIT }).catch(() => []),
    selectRows("post_engagements", { filters: [eq("userId", viewerId)], limit: FEED_CANDIDATE_LIMIT }).catch(() => []),
    selectRows("user_affinity", { filters: [eq("userId", viewerId)], limit: 5000 }).catch(() => []),
    selectRows("user_topic_affinity", { filters: [eq("userId", viewerId)], limit: 5000 }).catch(() => []),
    selectRows("post_distribution", { limit: FEED_CANDIDATE_LIMIT }).catch(() => []),
  ]);
  const byId = new Map(users.map((user) => [Number(user.id), user]));
  const privateById = new Map(settings.map((row) => [Number(row.userId), Boolean(row.privateAccount)]));
  const followingIds = new Set(following.map((row) => Number(row.followingId)));
  const blockedIds = new Set<number>();
  for (const row of blocked) {
    const blocker=Number(row.blockerId), blockedUser=Number(row.blockedId);
    if (blocker===viewerId) blockedIds.add(blockedUser);
    if (blockedUser===viewerId) blockedIds.add(blocker);
  }
  const statsByPost = new Map(stats.map((row) => [Number(row.postId), row]));
  const engagementRows = engagements as Array<{ postId: number; lastViewedAt?: string | Date | null }>;
  const seenByPost = new Set(engagementRows.filter((row) => row.lastViewedAt && Date.now()-new Date(row.lastViewedAt).getTime()<7*24*60*60*1000).map((row) => Number(row.postId)));
  const affinityByUser = new Map(affinities.map((row) => [Number(row.targetUserId), Math.max(0, Math.min(1, Number(row.score)||0))]));
  const topicByName = new Map(topics.map((row) => [String(row.topic??"").toLowerCase(), Math.max(0, Math.min(1, Number(row.score)||0))]));
  const distributionByPost = new Map(distributions.map((row) => [Number(row.postId), row]));
  const viewerCountry = String(byId.get(viewerId)?.country??"").trim().toLowerCase()||null;
  const coldStart = coldStartIsActive(posts, stats);

  const baseCandidates = posts.filter((post) => {
    const authorId=Number(post.userId);
    if (blockedIds.has(authorId)||seenByPost.has(Number(post.id))||Boolean(post.deletedAt)) return false;
    const isPrivate=privateById.get(authorId)??false;
    if (isPrivate&&authorId!==viewerId&&!followingIds.has(authorId)) return false;

    // Cold Start bypasses distribution status/stage/country gates only.
    // Privacy, blocking, deletion and seen-post protection remain enforced.
    if (!coldStart) {
      const distribution=distributionByPost.get(Number(post.id));
      if (distribution&&String(distribution.status)==="stopped") return false;
      if (distribution&&Number(distribution.stage)<4&&!followingIds.has(authorId)) {
        const countries=Array.isArray(distribution.countries)?distribution.countries.map(String):[];
        const author=byId.get(authorId);
        const authorCountry=String(author?.country??"").trim().toLowerCase();
        if (!countries.includes(viewerCountry??"")&&authorCountry!==viewerCountry) return false;
      }
    }
    return true;
  }).map((post) => {
    const author=byId.get(Number(post.userId));
    const hashtags=String(post.hashtags??"").toLowerCase().split(/[,\s#]+/).filter(Boolean);
    const topicMatch=hashtags.length?Math.max(...hashtags.map((topic)=>topicByName.get(topic)??0),0):0;
    const affinity=affinityByUser.get(Number(post.userId))??0;
    const stat=statsByPost.get(Number(post.id));
    const candidate: FeedRankingCandidate={
      id:Number(post.id),userId:Number(post.userId),createdAt:(post.createdAt as string | Date | null),
      likes:Number(stat?.likes??post.likes??0),comments:Number(stat?.comments??post.comments??0),
      saves:Number(stat?.saves??post.saves??0),shares:Number(stat?.shares??post.shares??0),
      impressions:Number(stat?.impressions??0),completionRate:Number(stat?.completionRate??0),
      affinity,topicMatch,following:followingIds.has(Number(post.userId)),
      local:Boolean(viewerCountry&&String(author?.country??"").trim().toLowerCase()===viewerCountry),
      negative:Number(post.reports??0)>0?1:0,sameAuthorCount:0,sameTopicCount:0,
      secondChance:String(distributionByPost.get(Number(post.id))?.status??"")==="held",
    };
    return {...post,authorDisplayName:author?.displayName??null,authorUsername:author?.username??null,authorAvatarUrl:author?.avatarUrl??null,authorCountry:(author?.country as string|null)??null,authorPrivate:privateById.get(Number(post.userId))??false,topicMatch,affinity,candidate} as unknown as FeedPostRow & {topicMatch:number;affinity:number;candidate:FeedRankingCandidate};
  });

  const followingPool=baseCandidates.filter(row=>row.candidate.following);
  const affinityPool=baseCandidates.filter(row=>!row.candidate.following&&row.candidate.affinity>0);
  const topicPool=baseCandidates.filter(row=>!row.candidate.following&&row.candidate.affinity<=0&&row.topicMatch>0);
  const localPool=baseCandidates.filter(row=>!row.candidate.following&&row.candidate.affinity<=0&&row.topicMatch<=0&&row.candidate.local);
  const explorationPool=baseCandidates.filter(row=>!row.candidate.following&&row.candidate.affinity<=0&&row.topicMatch<=0&&!row.candidate.local);
  // Yuniko Feed display order: newest public posts first.
  // Eligibility/privacy rules above still apply, but ranking must never push an older
  // post above a newer one in the main chronological feed.
  return baseCandidates
    .slice()
    .sort((a,b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())
    .slice(0,FEED_LIMIT);
}
function serializeFeedPost(
  row: FeedPostRow,
  likedIds: Set<number>,
  savedIds: Set<number>,
  followingIds: Set<number>,
) {
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
    isFollowing: followingIds.has(Number(row.userId)),
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
    const followingIds=new Set((await selectRows("follows",{select:"following_id",filters:[eq("followerId",req.userId!)],limit:5000}).catch(()=>[])).map(row=>Number(row.followingId)));
    const [likes,saves]=await Promise.all([
      selectRows("likes",{select:"post_id",filters:[eq("userId",req.userId!)]}).catch(()=>[]),
      selectRows("saves",{select:"post_id",filters:[eq("userId",req.userId!)]}).catch(()=>[]),
    ]);
    const likedIds=new Set(likes.map(row=>Number(row.postId)));
    const savedIds=new Set(saves.map(row=>Number(row.postId)));
    const sinceValue=typeof req.query["since"]==="string"?req.query["since"]:null;
    const sinceDate=sinceValue?new Date(sinceValue):null;
    const newPostsCount=sinceDate&&!Number.isNaN(sinceDate.getTime())?(await selectRows("posts",{filters:[eq("isWorldFeed",true),gt("createdAt",sinceDate)]})).length:0;
    const viewerCountry=normalizeCountry(viewer?.country as string|null|undefined);
    const countries=Array.from(new Set(candidates.map(row=>normalizeCountry(row.authorCountry)).filter(Boolean) as string[])).slice(0,7);
    return res.json({
      posts:candidates.map(row=>serializeFeedPost(row,likedIds,savedIds,followingIds)),
      newPostsCount,
      latestCreatedAt:candidates[0]?.createdAt??null,
      feedSnapshotAt:new Date().toISOString(),
      scope:{mode:countries.length?"countries":"world",countries,countryCount:countries.length,viewerCountry,label:countries.length?countries.length+" countries":"world"},
    });
  } catch(err) {
    return supabaseError(res,err);
  }
});
postsRouter.get("/posts/feed/updates", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const sinceValue = typeof req.query["since"] === "string" ? req.query["since"] : null;
  const sinceDate = sinceValue ? new Date(sinceValue) : null;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) return res.json({ newPostsCount: 0 });
  try {
    const rows = await selectRows("posts", {
      filters: [eq("isWorldFeed", true), gt("createdAt", sinceDate)],
      limit: FEED_CANDIDATE_LIMIT,
    });
    const newPostsCount = rows.filter((post) =>
      Number(post.userId) !== Number(req.userId) && !post.deletedAt,
    ).length;
    return res.json({ newPostsCount });
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

postsRouter.post("/posts/:postId/share", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const postId = Number(req.params.postId);
  const userId = Number(req.userId);
  const channel = req.body?.channel === "copy_link" ? "copy_link" : "native";
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post id" });

  try {
    const [post] = await selectRows("posts", {
      select: "id,user_id",
      filters: [eq("id", postId)],
      limit: 1,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    await insertRow("shares", {
      postId,
      userId,
      channel,
      createdAt: new Date(),
    });

    const shares = await selectRows("shares", {
      select: "id",
      filters: [eq("postId", postId)],
      limit: 10000,
    });

    try {
      const { createNotification } = await import("../lib/notifications");
      await createNotification(
        Number(post.userId),
        userId,
        "share",
        "Quelqu’un a partagé votre publication.",
        { postId, url: `/post/live_${postId}` },
      );
    } catch (error) {
      console.error("[YUNIKO SHARE] notification failed", error);
    }

    return res.json({ shared: true, shares: shares.length });
  } catch (err) {
    return supabaseError(res, err);
  }
});

postsRouter.delete("/posts/:postId", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post id" });

  try {
    const [post] = await selectRows("posts", {
      select: "id,user_id",
      filters: [eq("id", postId)],
      limit: 1,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (Number(post.userId) !== Number(req.userId)) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    const cleanupTables = [
      "likes", "saves", "shares", "post_engagements", "comments",
      "notifications", "post_edits", "post_media", "events",
      "post_stats", "post_distribution", "seen_posts",
    ];

    const deletedDependencies: Record<string, number> = {};
    for (const table of cleanupTables) {
      const deleted = await deleteRows(table, [eq("postId", postId)]);
      deletedDependencies[table] = deleted.length;
    }

    const deletedPosts = await deleteRows("posts", [
      eq("id", postId),
      eq("userId", req.userId!),
    ]);

    if (deletedPosts.length !== 1) {
      return res.status(500).json({
        error: "Post deletion did not affect the expected post",
        deletedDependencies,
      });
    }

    const [remaining] = await selectRows("posts", {
      select: "id",
      filters: [eq("id", postId)],
      limit: 1,
    });
    if (remaining) return res.status(500).json({ error: "Post still exists after deletion" });

    return res.json({ deleted: true, id: postId, deletedDependencies });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default postsRouter;