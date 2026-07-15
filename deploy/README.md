# Deployment Artifacts

Production-ready Kubernetes manifests and Docker Compose files for
Supercharg'd. All secrets in the templates use `REPLACE_ME` placeholders —
never commit real values.

## Structure

```
deploy/
├── k8s/
│   ├── backend-deployment.yaml      # API deployment + service + HPA + probes
│   └── mongo-backup-cronjob.yaml    # Daily 03:00 UTC mongodump → GPG → S3
└── monitoring/
    ├── docker-compose.yml           # Uptime Kuma one-file deploy
    └── uptime-kuma-monitors.json    # Pre-configured monitor bundle
```

## First-time deployment order

```bash
# 1. Namespace + secrets + config
kubectl apply -f deploy/k8s/backend-deployment.yaml

# 2. Automated backups
kubectl apply -f deploy/k8s/mongo-backup-cronjob.yaml

# 3. Uptime monitoring (separate host — do NOT co-locate with prod cluster)
cd deploy/monitoring && docker compose up -d

# 4. Verify probes are healthy
kubectl describe pod -n superchargd -l app=superchargd-api | grep -A 6 -E "Liveness|Readiness|Startup"
kubectl get cronjob -n superchargd
```

## Runbooks

- Mongo backup restore drills → `/app/docs/ops/mongo-backups.md`
- Uptime monitoring / alert routing → `/app/docs/ops/uptime-monitoring.md`
- Sentry source-map upload → `/app/docs/ops/sentry-source-maps.md`

## Rotating secrets

```bash
# JWT secret
NEW_KEY=$(openssl rand -hex 64)
kubectl -n superchargd patch secret superchargd-api-secrets \
  -p '{"stringData":{"JWT_SECRET_KEY":"'"$NEW_KEY"'"}}'
kubectl -n superchargd rollout restart deploy/superchargd-api

# Emergent LLM key
kubectl -n superchargd patch secret superchargd-api-secrets \
  -p '{"stringData":{"EMERGENT_LLM_KEY":"sk-emergent-NEW-KEY"}}'
kubectl -n superchargd rollout restart deploy/superchargd-api
```

## Verifying probes locally (against your dev pod)

```bash
curl -sS -o /dev/null -w "health: %{http_code}\n" http://localhost:8001/api/health
curl -sS -o /dev/null -w "ready:  %{http_code}\n" http://localhost:8001/api/ready
```
