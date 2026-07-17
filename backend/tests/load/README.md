# Backend Load Testing

Locust-driven load tests. See `locustfile.py` for the traffic model.

## Setup

```bash
pip install locust
```

## Run

```bash
export API=https://apex-service-advisor.preview.emergentagent.com
export TEST_PIN=11111

# Headless — quick sanity check
locust -f backend/tests/load/locustfile.py \
       --host $API --headless \
       --users 20 --spawn-rate 5 --run-time 1m \
       --csv=/tmp/loadtest

# With web UI for interactive tuning
locust -f backend/tests/load/locustfile.py --host $API
# Open http://localhost:8089
```

## Targets (baseline for a healthy build)

| Endpoint             | p50    | p95    | p99    | error % |
| -------------------- | ------ | ------ | ------ | ------- |
| GET  /api/health          | < 30ms  | < 100ms | < 200ms | 0%      |
| GET  /api/dashboard/stats | < 150ms | < 500ms | < 800ms | 0%      |
| POST /api/translate       | < 300ms | < 800ms | < 2000ms | 0–5% (429s expected under load) |
| POST /api/tower-talk      | < 800ms | < 3000ms | < 6000ms | 0–5% (429s expected under load) |

429 responses on `translate` / `tower-talk` above the per-user quota are
**expected and desirable** — they prove `slowapi` rate limiting is functioning.
