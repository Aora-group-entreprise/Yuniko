export type VideoFeatureConfig = {
  uploadEnabled: boolean;
  liveRecordingEnabled: boolean;
  mediaPublicBaseUrl: string;
};

/**
 * Video infrastructure is deliberately installed behind feature flags.
 * Keep both flags false until Yuniko is ready to activate persistent video.
 */
export function getVideoFeatureConfig(): VideoFeatureConfig {
  return {
    uploadEnabled: process.env.VIDEO_ENABLED === "true",
    liveRecordingEnabled: process.env.LIVE_RECORDING_ENABLED === "true",
    mediaPublicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL?.trim() ?? "",
  };
}

export function assertVideoUploadEnabled() {
  if (!getVideoFeatureConfig().uploadEnabled) {
    const error = new Error("Video upload is coming soon");
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
}

export function isLiveRecordingEnabled() {
  return getVideoFeatureConfig().liveRecordingEnabled;
}
