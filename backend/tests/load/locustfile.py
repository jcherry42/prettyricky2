"""
Load test suite for the Supercharg'd FastAPI backend.

Uses Locust (https://locust.io) — install with `pip install locust`.

Targets the four most-hit endpoints in production traffic:
  1. GET  /api/health                   — infra / K8s liveness
  2. GET  /api/dashboard/stats          — Command Center prefetch
  3. POST /api/tower-talk               — LLM reply generation (rate-limited 20/min/user)
  4. POST /api/translate                — LLM translation (rate-limited 40/min/user)

Usage:
    export API=https://apex-service-advisor.preview.emergentagent.com
    export TEST_PIN=11111
    locust -f backend/tests/load/locustfile.py \\
           --host $API \\
           --users 50 --spawn-rate 5 --run-time 2m

Interpretation:
  - health p95 should stay < 100ms even at 200 concurrent users.
  - dashboard/stats p95 < 500ms under 50 concurrent users.
  - tower-talk / translate rate-limit at 429 is EXPECTED behavior once the
    per-user quota is exceeded — this proves the guard is working.
"""

from __future__ import annotations

import os
import random
from locust import HttpUser, task, between


PIN = os.environ.get('TEST_PIN', '11111')


SAMPLE_TRANSLATIONS = [
    ('Hello, how are you?', 'es'),
    ('The car is ready for pickup.', 'es'),
    ('We have great financing options today.', 'fr'),
    ('Please call the service department.', 'ko'),
]

SAMPLE_TOWER_TALK_MESSAGES = [
    "The customer says the price is too high.",
    "They want to test drive the SUV this weekend.",
    "Customer is frustrated about the wait time.",
    "They asked about the trade-in value.",
]


class SuperchargdUser(HttpUser):
    """Simulates a dealership rep bouncing between health checks, dashboard
    refreshes, tower-talk generation, and translations."""

    wait_time = between(1.0, 4.0)

    def on_start(self) -> None:
        """Authenticate once per virtual user."""
        r = self.client.post('/api/auth/login', json={'pin': PIN}, name='auth/login')
        if r.ok:
            token = r.json().get('access_token')
            if token:
                self.client.headers['Authorization'] = f'Bearer {token}'
        else:
            # Not fatal — some endpoints (health) work without auth.
            self.client.headers.pop('Authorization', None)

    @task(30)
    def health(self) -> None:
        self.client.get('/api/health', name='GET /api/health')

    @task(10)
    def dashboard_stats(self) -> None:
        self.client.get('/api/dashboard/stats', name='GET /api/dashboard/stats')

    @task(3)
    def translate(self) -> None:
        text, target = random.choice(SAMPLE_TRANSLATIONS)
        with self.client.post(
            '/api/translate',
            json={'text': text, 'target_lang': target},
            name='POST /api/translate',
            catch_response=True,
        ) as r:
            if r.status_code == 429:
                # Expected once we blow past the 40/min/user quota — success signal.
                r.success()

    @task(2)
    def tower_talk(self) -> None:
        msg = random.choice(SAMPLE_TOWER_TALK_MESSAGES)
        with self.client.post(
            '/api/tower-talk',
            json={
                'inquiry_type': 'objection',
                'customer_message': msg,
                'customer_name': 'Load Test',
                'context': {},
            },
            name='POST /api/tower-talk',
            catch_response=True,
        ) as r:
            if r.status_code == 429:
                r.success()
