export type SfuConfig = {
  url: string;
  enabled: boolean;
};

/**
 * SFU configuration only. The current WebRTC path remains the default until
 * an SFU endpoint is explicitly configured. No recording/replay is supported.
 */
export function getSfuConfig(): SfuConfig {
  const url = process.env.LIVE_SFU_URL?.trim() ?? "";
  return { url, enabled: Boolean(url) };
}
