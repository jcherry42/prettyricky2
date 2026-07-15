# GitHub Actions — CI/CD Setup

Three workflows keep the demo channel fresh and the codebase safe.

| Workflow | Trigger | What it does |
|---|---|---|
| `pr-checks.yml` | Every PR to `main` | TS + ESLint + Ruff + Pytest — blocks merge if any fails |
| `eas-update-demo.yml` | Merge to `main` (auto) OR manual dispatch | Publishes JS-only OTA to the `demo` EAS channel |
| `eas-build-manual.yml` | Manual dispatch only | Full native rebuild for any profile |

---

## One-time setup (5 min)

### 1. Create an Expo access token

1. Go to [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
2. Click **Create Token** → give it a name like `github-actions-superchargd`
3. Copy the token (starts with a random string, shown ONCE)

### 2. Add the token as a GitHub secret

In your GitHub repo:

1. Settings → Secrets and variables → Actions → **New repository secret**
2. Name: `EXPO_TOKEN`
3. Value: paste the token from step 1
4. Save

That's it. All three workflows will now authenticate to EAS automatically.

### 3. (Optional) Enable branch protection on `main`

Settings → Branches → Add rule for `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: select `Mobile — TypeScript + Lint` and `Backend — Ruff + Pytest`

Now no one can push a broken bundle to demo devices.

---

## Daily use

### Ship a JS fix to demo phones (automatic)

Just merge a PR to `main`. The `eas-update-demo` workflow fires, publishes the OTA, and your demo phones pick it up on next launch. Watch it in the **Actions** tab.

### Ship a JS fix manually (hotfix without a PR)

Actions tab → **EAS Update — Demo Channel** → **Run workflow** → optionally enter a custom message → Run.

### Build a fresh native binary (any profile)

Actions tab → **EAS Build — Manual** → **Run workflow** → choose profile + platform → Run.

For the demo channel that's usually:
- Profile: `demo`
- Platform: `all`
- Auto-submit: `false`

For an App Store submission it's:
- Profile: `production`
- Platform: `all`
- Auto-submit: `true` (only if you've already run `eas submit:configure`)

---

## Cost expectations

- **OTA updates:** effectively free — no build minutes consumed.
- **EAS Builds (native):** consumes 1 credit per platform per build. Free tier includes 30/month; paid tiers give priority queue + more concurrency.
- **PR checks:** run on GitHub-hosted runners — free for public repos, generous free tier on private (2000 min/month).

---

## Failure modes to know about

### OTA update fails with "runtimeVersion mismatch"
The runtime version on the demo build doesn't match the JS bundle you're publishing. Cause: someone bumped a native dependency without rebuilding. Fix: run `eas-build-manual` for the `demo` profile to produce a new binary, then re-run the OTA.

### PR checks fail on ESLint with 0 warnings allowed
That's by design — treat warnings as errors so the codebase stays clean. Fix the warning or add an inline `// eslint-disable-next-line` with a comment explaining why.

### Backend pytest fails with Mongo connection error
The `services.mongo` container needs ~5s to start. Actions handles this automatically via health check. If you see intermittent failures, bump the `sleep` in the pytest step.

### Build workflow says "You've reached your build queue limit"
Free tier caps concurrency at 1. Upgrade to EAS paid tier or wait for the previous build to finish.

---

## Related runbooks

- EAS builds explained → `/app/docs/ops/eas-builds.md`
- Sentry integration → `/app/docs/ops/sentry-source-maps.md`
- Mongo backups → `/app/docs/ops/mongo-backups.md`
- Uptime monitoring → `/app/docs/ops/uptime-monitoring.md`
