"""
Iteration 23 — Print flow backend verification (App Store audit fixes).

Tests /api/print/preview, /api/print/vehicle, /api/print/license, /api/printer/test.
Print endpoints are mounted under api_router with auth deps → send Bearer.
"""
import base64
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://apex-service-advisor.preview.emergentagent.com",
).rstrip("/")
PIN = "11111"

# 1x1 transparent PNG
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    return s


def _assert_pdf_response(body: dict):
    assert body.get("success") is True, body
    b64 = body.get("pdf_base64")
    assert b64, "pdf_base64 missing"
    raw = base64.b64decode(b64)
    assert raw.startswith(b"%PDF"), "response is not a valid PDF"
    assert body.get("bytes", 0) > 500


class TestPrintPreview:
    def test_preview_vehicle(self, client):
        r = client.post(
            f"{BASE_URL}/api/print/preview",
            json={
                "type": "vehicle",
                "vin": "1HGCM82633A004352",
                "vehicle_data": {"year": 2003, "make": "Honda", "model": "Accord", "trim": "EX"},
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        _assert_pdf_response(r.json())

    def test_preview_license(self, client):
        r = client.post(
            f"{BASE_URL}/api/print/preview",
            json={"type": "license", "image_data": TINY_PNG_B64},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        _assert_pdf_response(r.json())

    def test_preview_bad_type(self, client):
        r = client.post(f"{BASE_URL}/api/print/preview", json={"type": "unknown"}, timeout=15)
        assert r.status_code == 400

    def test_preview_vehicle_missing_vin(self, client):
        r = client.post(f"{BASE_URL}/api/print/preview", json={"type": "vehicle"}, timeout=15)
        assert r.status_code == 400


class TestPrintVehicle:
    def test_print_vehicle_pdf(self, client):
        r = client.post(
            f"{BASE_URL}/api/print/vehicle",
            json={
                "vin": "1HGCM82633A004352",
                "vehicle_data": {"year": 2003, "make": "Honda", "model": "Accord"},
                "category": "active_inventory",
                "printer_ip": "",  # PDF only, no IPP
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        _assert_pdf_response(body)
        assert body.get("vin") == "1HGCM82633A004352"


class TestPrintLicense:
    def test_print_license_pdf(self, client):
        r = client.post(
            f"{BASE_URL}/api/print/license",
            json={"image_data": TINY_PNG_B64, "printer_ip": ""},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        _assert_pdf_response(r.json())


class TestPrinterTest:
    def test_unreachable_ip_returns_503(self, client):
        # 192.0.2.1 is TEST-NET-1 — guaranteed unreachable
        r = client.post(
            f"{BASE_URL}/api/printer/test",
            json={"ip": "192.0.2.1"},
            timeout=20,
        )
        # must fail gracefully — 503 (as coded) NOT 500 crash
        assert r.status_code in (503, 400), f"expected 503/400, got {r.status_code}: {r.text}"

    def test_empty_ip_returns_400(self, client):
        r = client.post(f"{BASE_URL}/api/printer/test", json={"ip": ""}, timeout=10)
        assert r.status_code == 400


class TestAuthEnforcement:
    def test_preview_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/print/preview",
            json={"type": "vehicle", "vin": "X"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected auth failure, got {r.status_code}"
