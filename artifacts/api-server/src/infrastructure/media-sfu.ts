import { isSfuEnabled } from "./video-features";

export type SfuConfig = {
  url: string;
  enabled: boolean;
};

/**
 * The SFU integration is shipped but opt-in. A configured URL alone never
 * activates it; SFU_ENABLED must explicitly be true.
 */
export function getSfuConfig(): SfuConfig {
  const url = process.env.LIVE_SFU_URL?.trim() ?? "";
  return { url, enabled: isSfuEnabled() && Boolean(url) };
}
