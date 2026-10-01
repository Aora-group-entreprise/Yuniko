export type FeedRankingConfig = {
  engagementWeight: number;
  velocityWeight: number;
  freshnessWeight: number;
  relevanceWeight: number;
  personalizationWeight: number;
  qualityWeight: number;
};

export type FeedRankingCandidate = {
  id: number;
  userId: number;
  createdAt: string | Date | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  impressions: number;
  completionRate: number;
  affinity: number;
  topicMatch: number;
  following: boolean;
  local: boolean;
  negative: number;
  sameAuthorCount: number;
  sameTopicCount: number;
  secondChance: boolean;
};

export type RankedFeedCandidate = FeedRankingCandidate & {
  score: number;
  engagementRate: number;
  velocity: number;
  freshness: number;
  relevance: number;
  personalization: number;
  quality: number;
};

const DEFAULT_CONFIG: FeedRankingConfig = {
  engagementWeight: 0.30,
  velocityWeight: 0.20,
  freshnessWeight: 0.15,
  relevanceWeight: 0.20,
  personalizationWeight: 0.10,
  qualityWeight: 0.05,
};

const AB_CONFIG: FeedRankingConfig = {
  engagementWeight: 0.25,
  velocityWeight: 0.20,
  freshnessWeight: 0.15,
  relevanceWeight: 0.20,
  personalizationWeight: 0.15,
  qualityWeight: 0.05,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function normalize(value: number, max: number) {
  return max > 0 ? clamp(value / max) : 0;
}

function hoursSince(value: string | Date | null) {
  const time = value instanceof Date ? value.getTime() : new Date(String(value ?? 0)).getTime();
  return Math.max(0.05, (Date.now() - time) / 3_600_000);
}

export function getFeedRankingConfig(variant: "A" | "B") {
  return variant === "B" ? AB_CONFIG : DEFAULT_CONFIG;
}

export function rankFeedCandidates(
  candidates: FeedRankingCandidate[],
  variant: "A" | "B",
): RankedFeedCandidate[] {
  const config = getFeedRankingConfig(variant);
  const maxEngagement = Math.max(...candidates.map((candidate) => {
    const impressions = Math.max(1, candidate.impressions);
    return (candidate.likes + 3 * candidate.comments + 4 * candidate.saves + 5 * candidate.shares) / impressions;
  }), 0);
  const maxVelocity = Math.max(...candidates.map((candidate) => {
    const impressions = Math.max(1, candidate.impressions);
    const engagement = (candidate.likes + 3 * candidate.comments + 4 * candidate.saves + 5 * candidate.shares) / impressions;
    return engagement / hoursSince(candidate.createdAt);
  }), 0);
  const secondChanceMedian = [...candidates]
    .map((candidate) => (candidate.likes + candidate.comments + candidate.saves + candidate.shares) / Math.max(1, candidate.impressions))
    .sort((a, b) => a - b)[Math.floor(candidates.length / 2)] ?? 0;

  return candidates.map((candidate) => {
    const impressions = Math.max(1, candidate.impressions);
    const engagement = (candidate.likes + 3 * candidate.comments + 4 * candidate.saves + 5 * candidate.shares) / impressions;
    const velocity = engagement / hoursSince(candidate.createdAt);
    const freshness = Math.exp(-hoursSince(candidate.createdAt) / 12);
    const relevance = clamp(
      (candidate.following ? 0.5 : 0) +
      clamp(candidate.affinity) * 0.3 +
      clamp(candidate.topicMatch) * 0.2,
    );
    const personalization = clamp(
      clamp(candidate.affinity) * 0.6 +
      clamp(candidate.topicMatch) * 0.25 +
      (candidate.local ? 0.15 : 0),
    );
    const quality = clamp(
      0.45 * clamp(candidate.completionRate / 100) +
      0.35 * (1 - clamp(candidate.negative)) +
      0.20 * freshness,
    );
    const negative = clamp(candidate.negative);
    const diversityPenalty = candidate.sameAuthorCount > 0 ? 0.6 : candidate.sameTopicCount > 0 ? 0.8 : 1;
    const secondChanceBoost =
      candidate.secondChance &&
      impressions < 200 &&
      engagement > secondChanceMedian
        ? 0.15
        : 0;
    const base =
      config.engagementWeight * normalize(engagement, maxEngagement) +
      config.velocityWeight * normalize(velocity, maxVelocity) +
      config.freshnessWeight * freshness +
      config.relevanceWeight * relevance +
      config.personalizationWeight * personalization +
      config.qualityWeight * quality;
    const score = Math.max(0, base * (1 - negative) * diversityPenalty + secondChanceBoost);

    return {
      ...candidate,
      score,
      engagementRate: engagement,
      velocity,
      freshness,
      relevance,
      personalization,
      quality,
    };
  }).sort((a, b) => b.score - a.score);
}

export function mixCandidateSources<T extends { id: number }>(
  pools: Array<{ rows: T[]; quota: number }>,
  limit: number,
) {
  const selected: T[] = [];
  const seen = new Set<number>();
  for (const pool of pools) {
    const target = Math.min(pool.rows.length, Math.floor(limit * pool.quota));
    for (const row of pool.rows.slice(0, target)) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        selected.push(row);
      }
    }
  }
  if (selected.length < limit) {
    for (const pool of pools) {
      for (const row of pool.rows) {
        if (selected.length >= limit) break;
        if (!seen.has(row.id)) {
          seen.add(row.id);
          selected.push(row);
        }
      }
    }
  }
  return selected;
}
