# Supercharg'd — Test Credentials

## Primary Test Account
- **PIN**: `11111`
- **Login endpoint**: `POST /api/auth/login` with body `{"pin": "11111"}`
- **Setup endpoint** (if PIN reset/cleared): `POST /api/auth/setup-pin` with body `{"pin": "11111"}`

## Master Factory Reset Code
- **Code**: `V593GSZ8` (from previous session — only valid until next factory reset)
- **Endpoint**: `POST /api/auth/factory-reset` with body `{"master_code": "V593GSZ8"}`
- Note: A new reset code is generated and shown ONCE on each fresh PIN setup.

## Auth Flow
1. `POST /api/auth/login {"pin":"11111"}` → returns `{access_token, refresh_token, ...}`
2. Send `Authorization: Bearer <access_token>` on subsequent requests
3. On 401, `POST /api/auth/refresh {"refresh_token":"..."}` → returns NEW `{access_token, refresh_token, ...}` (refresh tokens are rotated; old jti is denylisted)
4. Mobile auto-refresh: `apiFetch()` in `/app/mobile/src/lib/api.ts` handles 401→refresh→retry automatically. Failed refresh fires `onRefreshFailure()` → AuthContext forces logout to PIN screen.
5. `POST /api/auth/logout {"refresh_token":"..."}` → server-side revocation (refresh jti added to denylist, returns 200 idempotently)

## Server-side token revocation
- Every refresh token has a unique `jti` claim
- `revoked_tokens` MongoDB collection holds the denylist with TTL = remaining exp (auto-cleans)
- Rotation: on every successful `/api/auth/refresh`, OLD jti is revoked and a NEW pair issued
- Logout: revokes the supplied refresh token's jti immediately

## Notes for Testing Agent
- All protected endpoints under `/api/*` (except `/auth/*` and `/diagnostics`) require Bearer auth → 401 without token
- `/api/auth/refresh` and `/api/auth/logout` are public (must be — clients call them after access expires)
- Telemetry events with `session_id` starting `sess-` are test-only and have 90-day TTL
- `JWT_SECRET_KEY` is now set in `/app/backend/.env` → tokens survive backend restarts
