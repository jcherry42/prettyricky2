# Uptime & Health Monitoring Runbook

**Owner:** Ops / DevOps
**Frequency:** Continuous
**Last reviewed:** 2026-02

---

## 1. What we monitor

| Endpoint | Purpose | Success signal | Frequency |
|---|---|---|---|
| `GET /api/health` | Application + scheduler + data-source liveness (cached 5s) | `200`, JSON body has `status: "healthy"` | 30s |
| `GET /api/ready` | Kubernetes-style readiness — DB reachable? | `200`, body `{"ready": true, "db": "up"}` | 60s |
| `GET /api/metrics` | High-cardinality counters (customers, vehicles, sessions) | `200`, latency < 500ms | 5m |
| `GET /` (frontend) | Mobile OTA update channel + support site | `200` | 5m |
| `POST /api/auth/login` synthetic | End-to-end auth roundtrip | `200` with valid JWT | 5m |

`/api/ready` returns `503` when the DB is unreachable — this is intentional
and monitors should treat 503 as **DOWN**, not a warning.

---

## 2. Recommended stack

Pick ONE primary + ONE backup:

### Primary options

- **Uptime Kuma** (self-hosted, free, dead-simple)
- **Pingdom** (paid, best UI, global check locations)
- **Datadog Synthetics** (paid, integrates with APM if you also use Datadog)
- **Better Uptime / BetterStack** (paid, best notifications + status page)

### Backup (separate provider, so you notice if the primary is down)

- **UptimeRobot** (free tier: 50 monitors, 5-min interval)
- **Cronitor** (heartbeat + uptime combined)

**Rule:** never monitor from a single provider. If your primary goes down,
you'll never know.

---

## 3. Uptime Kuma setup (recommended for self-hosted)

### Deploy

```bash
docker run -d --restart=always -p 3001:3001 \
  -v /opt/uptime-kuma:/app/data \
  --name uptime-kuma louislam/uptime-kuma:1
```

### Monitors to add

| Name | Type | URL | Interval | Retry | Expected |
|---|---|---|---|---|---|
| API Health | HTTP(s) | `https://api.superchargd.com/api/health` | 30s | 3 | HTTP 200, keyword `"status":"healthy"` |
| API Ready | HTTP(s) | `https://api.superchargd.com/api/ready` | 60s | 2 | HTTP 200, keyword `"ready":true` |
| Auth Synthetic | HTTP(s) POST | `https://api.superchargd.com/api/auth/login` | 5m | 2 | HTTP 200 body — see synthetic script below |
| Landing Page | HTTP(s) | `https://superchargd.com` | 5m | 2 | HTTP 200 |
| MongoDB Reachable | TCP Port | `prod-mongo.internal:27017` | 60s | 3 | Port open |

### Notification channels

Add ALL of these — they cover different failure modes:

1. **Discord webhook** to `#alerts-prod` (immediate team visibility)
2. **Email** to on-call rotation
3. **SMS** (Twilio) for P0 outages
4. **Slack webhook** as backup to Discord

---

## 4. Synthetic auth check

Uptime Kuma can execute HTTP POSTs. Configure the "Auth Synthetic" monitor:

- **Method:** POST
- **URL:** `https://api.superchargd.com/api/auth/login`
- **Headers:** `Content-Type: application/json`
- **Body:** `{"pin":"11111"}`   *(use a dedicated monitoring PIN, NOT the real admin PIN)*
- **Expected keyword:** `access_token`
- **Expected HTTP status:** 200

**Setup step:** create a dedicated monitoring PIN in Mongo:

```javascript
// mongosh
db.pin_auth.insertOne({
  _id: "monitor",
  pin_hash: "<bcrypt of a dedicated monitoring PIN>",
  role: "monitor",
  created_at: new Date()
})
```

Then rate-limit monitor calls in the backend so they can't be used for
credential stuffing (the endpoint already has slowapi at 20/min/IP).

---

## 5. Alert routing

| Severity | Trigger | Route |
|---|---|---|
| **P0** (page immediately) | `/api/health` DOWN for >2 minutes, OR `/api/ready` DOWN for >1 minute | SMS + phone call to on-call |
| **P1** (notify) | Any single monitor DOWN, OR latency p95 > 3× baseline for 10m | Slack #alerts-prod + email |
| **P2** (dashboard only) | Individual scrape misses, non-critical endpoint slow | Grafana dashboard, no push |

**Silence rules:**
- Auto-silence monitors during known-maintenance windows (put in calendar → tag monitors)
- Deduplication window: 15 minutes (a flapping monitor shouldn't page 20 times)

---

## 6. Status page (public-facing)

Publish a lightweight status page so customers self-serve during incidents:

- **BetterStack Status Page** (bundled with their uptime product)
- **Instatus** (free tier for small teams)
- **Statuspage.io** (Atlassian, enterprise)

Sections to publish:
- API
- Mobile app (via EAS Update channel status)
- AI features (LLM upstreams — OpenAI, Emergent)
- Print service

Historically the biggest confidence-building move is showing customers you
detected the issue before they did.

---

## 7. Kubernetes probe config (if you deploy via K8s)

The backend already exposes `/api/health` (5s cache, cheap) and `/api/ready`
(explicit DB ping). Wire them into your deployment:

```yaml
spec:
  containers:
    - name: superchargd-api
      livenessProbe:
        httpGet:
          path: /api/health
          port: 8001
        initialDelaySeconds: 15
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /api/ready
          port: 8001
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 3
        failureThreshold: 2
```

`livenessProbe` failing → K8s restarts the pod. `readinessProbe` failing →
K8s stops sending traffic to that pod but doesn't restart it. Correct
separation of concerns is critical: don't use `/api/ready` as a liveness
probe — a brief DB blip would cause a restart storm.

---

## 8. Escalation matrix

```
Detected (0–5 min)         → auto-alert fires to on-call
Acknowledged (5–15 min)    → on-call posts in #incident-mgmt
Diagnosed (15–45 min)      → root cause identified, mitigation plan
Mitigated (varies)         → symptoms restored (may not be full fix)
Resolved (varies)          → underlying cause fixed
Post-mortem (within 5 days) → written, shared, action items filed
```

For any P0 incident lasting > 30 minutes, notify customers via status page
and email. For any incident affecting billable customer flows (VIN scan,
DL scan, Tower Talk), record it in the post-mortem folder even if brief.
