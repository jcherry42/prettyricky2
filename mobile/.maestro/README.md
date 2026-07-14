# Maestro E2E Test Suite

Automated black-box UI tests for the Supercharg'd mobile app, driven by
[Maestro](https://maestro.mobile.dev). Runs against a real device or simulator
against a live backend.

## Prerequisites

```bash
# macOS
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify
maestro --version
```

## Running

```bash
# Ensure the app is installed on the device/simulator and the backend is reachable
cd /app/mobile

# Run a single flow
maestro test .maestro/flows/pin_setup.yaml

# Run every flow in sequence
maestro test .maestro/flows/

# Record a new flow interactively
maestro record .maestro/flows/new_flow.yaml
```

## Flow inventory

| File | Coverage | Tags |
| --- | --- | --- |
| `flows/pin_setup.yaml` | First-launch PIN creation + master reset code display | `full`, `auth` |
| `flows/pin_login.yaml` | Returning-user PIN login | `smoke`, `auth` |
| `flows/backend_diagnostic.yaml` | Connection diagnostic modal → reset override → probe | `smoke`, `network` |
| `flows/customer_manual_create.yaml` | Add new customer via Floating button → verify in Command Center | `smoke`, `customer` |
| `flows/service_mode_toggle.yaml` | Sales ↔ Service persona swap + lingo verification | `smoke`, `mode` |

### Suggested smoke bundle (< 90s total)

```bash
maestro test .maestro/flows/pin_login.yaml \
             .maestro/flows/backend_diagnostic.yaml \
             .maestro/flows/customer_manual_create.yaml \
             .maestro/flows/service_mode_toggle.yaml
```

## Environment

Flows expect `env` to be provided at run-time:

```bash
maestro test --env=APP_ID=com.superchargd.mobile \
             --env=TEST_PIN=11111 \
             .maestro/flows/pin_login.yaml
```

`APP_ID` defaults to `com.superchargd.mobile`. `TEST_PIN` matches
`/app/memory/test_credentials.md`.

## CI integration (future)

Wire into EAS Build post-hook or a dedicated Maestro Cloud project. Suggested
smoke set for every PR: `pin_login → backend_diagnostic → customer_manual_create`.
