/**
 * Phase 3 scaling decisions.
 *
 * Media storage/CDN and an SFU are intentionally not introduced at this stage:
 * - Live remains ephemeral and must not record or archive media.
 * - The current transport is WebRTC signaling; an SFU should be introduced when
 *   concurrent viewer counts justify it, without changing the product semantics.
 * - Object storage/CDN should be introduced when media volume/egress requires it.
 *
 * Keep these decisions explicit so future infrastructure work does not silently
 * turn Live into a recording product.
 */
export const SCALING_POLICY = {
  live: { mode: "ephemeral-webrtc", recording: false, replay: false },
  mediaStorage: { mode: "current", cdn: false },
  feed: { mode: "database", cache: false },
} as const;
