import { getVideoFeatureConfig } from "./video-features";

export type LiveRecording = {
  liveId: number;
  objectKey: string;
};

export interface LiveRecorder {
  start(input: { liveId: number }): Promise<LiveRecording | null>;
  stop(input: { liveId: number }): Promise<LiveRecording | null>;
}

/**
 * The recording boundary is installed now, but disabled until persistent video
 * is activated. The current Live remains WebRTC-only and creates no recording.
 */
class DisabledLiveRecorder implements LiveRecorder {
  async start(_input: { liveId: number }): Promise<LiveRecording | null> {
    return null;
  }

  async stop(_input: { liveId: number }): Promise<LiveRecording | null> {
    return null;
  }
}

class ConfiguredLiveRecorder implements LiveRecorder {
  async start(_input: { liveId: number }): Promise<LiveRecording | null> {
    throw new Error("Live recording adapter is not configured for this deployment");
  }

  async stop(_input: { liveId: number }): Promise<LiveRecording | null> {
    throw new Error("Live recording adapter is not configured for this deployment");
  }
}

export function getLiveRecorder(): LiveRecorder {
  const config = getVideoFeatureConfig();
  return config.liveRecordingEnabled ? new ConfiguredLiveRecorder() : new DisabledLiveRecorder();
}
