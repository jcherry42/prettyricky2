# MongoDB Backup Runbook

**Owner:** Ops / DevOps
**Frequency:** Daily automated + weekly retention verification
**Last reviewed:** 2026-02

---

## 1. Backup strategy

| Layer | Frequency | Retention | Tooling |
|---|---|---|---|
| Point-in-time (PITR) | Continuous oplog capture | 24 hours | MongoDB Atlas built-in / `mongodump` + oplog on self-hosted |
| Full snapshot | Every 6 hours | 7 days | Atlas Cloud Backups / Percona pmm |
| Weekly cold copy | Every Sunday 03:00 UTC | 90 days | Encrypted upload to S3 |
| Monthly archive | 1st of month | 7 years | S3 Glacier Deep Archive |

The 24h PITR + 7-day snapshots cover the two failure modes that actually
happen (dropped collection, corrupted document). The weekly + monthly copies
cover regulatory / audit needs.

---

## 2. If you're on MongoDB Atlas (recommended)

### Enable

1. Atlas → your cluster → **Backup** tab → toggle **Cloud Backups: ON**.
2. Set snapshot cadence to **every 6 hours** and PITR window to **24h**.
3. Configure export → S3 for weekly + monthly copies.
4. Enable **Backup Compliance Policy** (locks retention so a compromised
   admin can't shorten it or delete snapshots).

### Verify weekly

```bash
# List available snapshots
atlas backups snapshots list --clusterName prod-cluster \
  --projectId $ATLAS_PROJECT_ID --limit 10

# Restore-drill: create a target cluster from the latest snapshot
atlas backups restores start automated \
  --snapshotId <SNAPSHOT_ID> \
  --clusterName restore-drill \
  --targetClusterName restore-drill-target \
  --targetProjectId $ATLAS_PROJECT_ID
```

**Restore-drill cadence: monthly.** A backup you've never restored is not a backup.

---

## 3. If you're self-hosted (Docker / K8s / bare metal)

### Daily `mongodump` cron

Create `/opt/superchargd/scripts/mongo-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
DEST="/var/backups/mongo/${TS}"
mkdir -p "$DEST"

# Full dump with oplog (allows PITR replay up to now())
mongodump \
  --uri "$MONGO_URL" \
  --out "$DEST" \
  --gzip \
  --oplog \
  --numParallelCollections=4

# Encrypt before uploading
tar czf - "$DEST" | \
  gpg --batch --yes --passphrase-file /etc/superchargd/backup.key \
      --symmetric --cipher-algo AES256 \
      -o "$DEST.tar.gz.gpg"

# Upload
aws s3 cp "$DEST.tar.gz.gpg" "s3://superchargd-mongo-backups/$(hostname)/${TS}.tar.gz.gpg" \
  --storage-class STANDARD_IA

# Cleanup local files older than 3 days
find /var/backups/mongo -mindepth 1 -maxdepth 1 -type d -mtime +3 -exec rm -rf {} \;
```

Crontab:

```
# Daily @ 03:00 UTC
0 3 * * * /opt/superchargd/scripts/mongo-backup.sh >> /var/log/mongo-backup.log 2>&1
```

### Restore

```bash
# 1. Download + decrypt
aws s3 cp s3://superchargd-mongo-backups/$HOST/20260101T030000Z.tar.gz.gpg /tmp/
gpg --batch --yes --passphrase-file /etc/superchargd/backup.key \
    -d /tmp/20260101T030000Z.tar.gz.gpg | tar xzf - -C /tmp/restore/

# 2. Restore to a NEW database (never overwrite prod directly)
mongorestore \
  --uri "$MONGO_URL_RESTORE_TARGET" \
  --gzip \
  --oplogReplay \
  --nsFrom='superchargd_prod.*' \
  --nsTo='superchargd_restore.*' \
  /tmp/restore/

# 3. Sanity queries
mongosh "$MONGO_URL_RESTORE_TARGET" --eval '
  use superchargd_restore;
  db.customers.countDocuments();
  db.customers.findOne({}, {first_name: 1, created_at: 1});
'

# 4. Cutover — only after sanity checks pass
```

---

## 4. Encryption keys

Store `/etc/superchargd/backup.key` in:
- Production: Hashicorp Vault / AWS Secrets Manager / GCP Secret Manager
- Staging: your platform secret store, separate key from prod
- Never in git, never in `.env`, never in AMI images

Rotate the key annually or on suspected compromise. When rotating, keep the
old key available for restoring existing backups until they age out.

---

## 5. Monitoring

Alerts fire on:
- Backup job hasn't completed in the last 26h (grace on top of daily 24h)
- Snapshot size drops by >20% vs. rolling 7-day average (indicates data loss)
- S3 upload failure

Wire these into your alerting stack (Pagerduty / Opsgenie / Discord webhook).
Sample Prometheus rule:

```yaml
- alert: MongoBackupOverdue
  expr: time() - mongodb_last_backup_success_seconds > 93600
  labels:
    severity: page
  annotations:
    summary: "Mongo backup hasn't completed in >26h on {{ $labels.instance }}"
    runbook: "https://internal/runbooks/mongo-backups.md"
```

---

## 6. Restore-drill sign-off

Track completed drills in `/app/docs/ops/drills/`:

```
2026-02-15 — Full restore from previous day snapshot to isolated cluster.
              customers count: 8,412 (prod: 8,412) ✅
              vehicles count: 3,127 (prod: 3,127) ✅
              Drill completed by: @<engineer>
              Time to restore: 47 minutes
```

Drills that don't happen become drills that fail in a real incident.
