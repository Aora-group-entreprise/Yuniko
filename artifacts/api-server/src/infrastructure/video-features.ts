export type VideoFeatureConfig = {
  uploadEnabled: boolean;
  liveEnabled: boolean;
  sfuEnabled: boolean;
  liveRecordingEnabled: boolean;
  mediaPublicBaseUrl: string;
};

/**
 * Video/Live infrastructure stays installed but disabled until Yuniko is
 * ready. Nothing becomes active merely because an endpoint is configured.
 */
export function getVideoFeatureConfig(): VideoFeatureConfig {
  return {
    uploadEnabled: process.env.VIDEO_ENABLED === "true",
    liveEnabled: process.env.LIVE_ENABLED === "true",
    sfuEnabled: process.env.SFU_ENABLED === "true",
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

export function assertLiveEnabled() {
  if (!getVideoFeatureConfig().liveEnabled) {
    const error = new Error("Live is coming soon");
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
}

export function assertSfuEnabled() {
  if (!getVideoFeatureConfig().sfuEnabled) {
    const error = new Error("Live SFU is not enabled");
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

export function isLiveRecordingEnabled() {
  return getVideoFeatureConfig().liveRecordingEnabled;
}

export function isSfuEnabled() {
  return getVideoFeatureConfig().sfuEnabled;
}
