export type FeedSignal = {
  likes: number;
  shares: number;
  comments: number;
  views: number;
};

export type RankedFeedSignal = FeedSignal & { score: number; engagementRate: number };

/** Deterministic, bounded ranking used by the global feed. */
export function rankFeedSignal(signal: FeedSignal): RankedFeedSignal {
  const likes = Math.max(0, signal.likes);
  const shares = Math.max(0, signal.shares);
  const comments = Math.max(0, signal.comments);
  const views = Math.max(0, signal.views);
  const score = likes * 10 + shares * 5 + comments * 3 + views / 20;
  const engagementRate = views > 0 ? (likes + shares + comments) / views : 0;
  return { likes, shares, comments, views, score, engagementRate };
}

export function rankFeedBatch<T extends FeedSignal>(items: T[]): Array<T & { score: number; engagementRate: number }> {
  return items
    .map((item) => ({ ...item, ...rankFeedSignal(item) }))
    .sort((a, b) => b.score - a.score);
}
