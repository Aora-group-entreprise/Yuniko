export const DISTRIBUTION_STAGES = [
  { stage: 1, countries: 3, minImpressions: 2300, minEngagementRate: 0.06, minVelocity: 0.04, maxHours: 6 },
  { stage: 2, countries: 5, minImpressions: 1500, minEngagementRate: 0.05, minVelocity: 0.03, maxHours: 12 },
  { stage: 3, countries: 7, minImpressions: 4000, minEngagementRate: 0.04, minVelocity: 0.02, maxHours: 24 },
  { stage: 4, countries: Number.MAX_SAFE_INTEGER, minImpressions: 0, minEngagementRate: 0, minVelocity: 0, maxHours: Number.MAX_SAFE_INTEGER },
] as const;

export function wilsonLowerBound(successes: number, trials: number, z = 1.96) {
  if (trials <= 0) return 0;
  const p = Math.max(0, Math.min(1, successes / trials));
  const z2 = z * z;
  return (p + z2 / (2 * trials) - z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)) / (1 + z2 / trials);
}

export function distributionPasses(
  stage: 1 | 2 | 3,
  impressions: number,
  engagementRate: number,
  velocity: number,
  ageHours: number,
  rollingEngagementThreshold = 0,
  rollingVelocityThreshold = 0,
) {
  const config = DISTRIBUTION_STAGES[stage - 1];
  const effectiveEngagement = impressions < 300
    ? wilsonLowerBound(Math.round(engagementRate * impressions), impressions)
    : engagementRate;
  return impressions >= config.minImpressions &&
    effectiveEngagement >= Math.max(config.minEngagementRate, rollingEngagementThreshold) &&
    velocity >= Math.max(config.minVelocity, rollingVelocityThreshold) &&
    ageHours <= config.maxHours;
}

export function countryScore(
  followerSignal: number,
  languageSignal: number,
  creatorAffinity: number,
  topicReceptivity: number,
) {
  return 0.40 * followerSignal + 0.25 * languageSignal + 0.20 * creatorAffinity + 0.15 * topicReceptivity;
}
