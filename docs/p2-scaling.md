# Yuniko P2 scaling

P2 is deliberately prepared without forcing paid infrastructure at launch.

## 46 — SFU
`SFU_ENABLED` remains the explicit switch. A real SFU endpoint is required through `LIVE_SFU_URL`; configuration alone never activates it.

## 47 — Object Storage
Supabase Storage remains the first object-storage target. Media metadata belongs in PostgreSQL; binary media does not.

## 48 — CDN
Set `MEDIA_CDN_ENABLED=true` only when a CDN is actually configured. `MEDIA_PUBLIC_BASE_URL` supplies the delivery base URL.

## 49 — Redis
`REDIS_ENABLED=false` by default. `REDIS_URL` is required when enabled. No Redis dependency is required for a single-server deployment.

## 50–51 — Feed scaling/cache
Feed optimization and caching can use the cache contract without changing Feed API callers. `FEED_CACHE_ENABLED` is opt-in; metrics expose cache hits/misses before enabling it broadly.

## 52 — Monitoring
`monitoring.ts` provides low-overhead Feed/Live counters. A production metrics backend can consume the same measurements later.

## 53 — External alerts
Disabled by default. `EXTERNAL_ALERTS_ENABLED=true` plus `EXTERNAL_ALERT_WEBHOOK` is required before any external notification is sent.

## 54 — Multi-server
`shared-state.ts` defines the shared signaling/cache contract. `MULTI_SERVER_ENABLED` refuses to start without a configured shared broker, preventing split-brain signaling between servers.

### Default launch posture

```text
SFU_ENABLED=false
REDIS_ENABLED=false
FEED_CACHE_ENABLED=false
MONITORING_ENABLED=false
EXTERNAL_ALERTS_ENABLED=false
MULTI_SERVER_ENABLED=false
MEDIA_CDN_ENABLED=false
```
