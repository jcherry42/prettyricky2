# Sentry Source Map Upload — Build-Time Setup

**Purpose:** Ensure stack traces in Sentry point at your original TypeScript
source, not the minified bundle.

---

## 1. What you need

| Secret | Where to get it | Where it lives |
|---|---|---|
| `SENTRY_ORG` | Sentry → Settings → your org → slug in URL | EAS secret |
| `SENTRY_PROJECT` | Sentry → your project → Settings → slug in URL | EAS secret |
| `SENTRY_AUTH_TOKEN` | Sentry → User Settings → API → Auth Tokens → create with scopes: `project:releases`, `project:read`, `org:read` | EAS secret (NEVER in git or in `EXPO_PUBLIC_*`) |

`EXPO_PUBLIC_*` vars are baked into the JS bundle and visible to anyone
who reverse-engineers your app. `SENTRY_AUTH_TOKEN` must NOT be public.

---

## 2. One-time setup

```bash
cd /app/mobile

# Log in to EAS
npx eas login

# Store the auth token as an EAS secret (encrypted, per-project)
npx eas secret:create --scope project --name SENTRY_AUTH_TOKEN \
  --value "sntrys_XXXXXXXXXXXXXXXXXXXXXXXXX"

npx eas secret:create --scope project --name SENTRY_ORG \
  --value "your-sentry-org-slug"

npx eas secret:create --scope project --name SENTRY_PROJECT \
  --value "your-sentry-project-slug"

# Verify
npx eas secret:list
```

---

## 3. How the pipeline works

1. `metro.config.js` wraps the default Expo Metro config with
   `getSentryExpoConfig`, which registers a Metro transformer that emits
   source maps alongside the JS bundle.
2. The `@sentry/react-native/expo` plugin in `app.json` hooks into the
   Expo build process. During `eas build`, it:
   - Runs the standard Metro bundle.
   - Reads `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` from the EAS
     environment.
   - Creates a Sentry release named `com.superchargd.mobile@<version>+<build>`.
   - Uploads the JS bundle + source maps to Sentry.
   - Optionally uploads iOS dSYMs (native crashes) if the build produces them.
3. When a crash happens in production, Sentry unminifies the stack trace
   using the uploaded source maps.

If `SENTRY_AUTH_TOKEN` is missing, the plugin skips upload without failing
the build — the app still ships, but crashes will show minified stack traces.

---

## 4. Verify a release uploaded

```bash
# After `eas build --profile production` completes
npx sentry-cli releases list --org "$SENTRY_ORG" --project "$SENTRY_PROJECT"
```

You should see something like:

```
com.superchargd.mobile@1.0.0+1  (created 2 minutes ago)
```

Also visible in Sentry UI → Releases.

---

## 5. Trigger a test crash

Add a hidden test-crash button in a debug menu (or use the diagnostic modal
you already have on the PIN screen) that calls:

```ts
import { captureException } from '../lib/sentry';
captureException(new Error('SentryTest — please ignore'));
```

Or force a crash:

```ts
throw new Error('SentryTest — please ignore');
```

The error should appear in Sentry within 60s, and clicking it should show
your original TypeScript source (not minified).

---

## 6. Backend source maps (Python)

Python doesn't minify — stack traces are always readable. No source-map
upload is needed for the FastAPI backend. `sentry-sdk` handles everything
automatically once `SENTRY_DSN_BACKEND` is set.

---

## 7. Ongoing hygiene

- Rotate `SENTRY_AUTH_TOKEN` every 12 months.
- If a Sentry auth token is committed to git by accident, revoke it
  IMMEDIATELY at Sentry → User Settings → API → Auth Tokens.
- Keep `SENTRY_TRACES_SAMPLE_RATE` low in production (0.01–0.05) unless
  actively debugging — traces are billed per span.
- Set an alert in Sentry itself when your monthly event quota is 80% consumed.
