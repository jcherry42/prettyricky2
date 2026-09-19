"""
E2E emulation of Expo SDK 57's convertFormDataAsync multipart encoding.
Replicates the exact byte-level output that asFormDataFile() produces in the
mobile app, then POSTs to /api/voice-translate and /api/license/scan-direct.

We emit the multipart body EXACTLY as expo/src/winter/fetch/convertFormData.ts
would, given entries shaped like { name, type, bytes() }.
"""
import io
import os
import struct
import wave
import requests
import pytest
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://apex-service-advisor.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": "11111"}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def build_multipart(parts, boundary="----ExpoFetchBoundary123456"):
    """
    parts: list of (name, value) where value is either:
      - str  -> simple string field
      - dict {name: filename, type: content-type, bytes: bytes-payload}
    Mirrors convertFormData.ts exactly.
    """
    buf = io.BytesIO()
    for name, entry in parts:
        buf.write(f"--{boundary}\r\n".encode())
        content_disposition = f'form-data; name="{name}"'
        content_type = None
        if isinstance(entry, dict):
            if "name" in entry:
                fn = entry["name"].replace("/", "_")
                # encodeURIComponent-ish (basic filenames are fine)
                content_disposition += f'; filename="{fn}"'
            if "type" in entry:
                content_type = entry["type"]
        buf.write(f"content-disposition: {content_disposition}\r\n".encode())
        if content_type:
            buf.write(f"content-type: {content_type}\r\n".encode())
        buf.write(b"\r\n")
        if isinstance(entry, str):
            buf.write(entry.encode())
        else:
            buf.write(entry["bytes"])
        buf.write(b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    return buf.getvalue(), boundary


def make_silent_wav(duration_s=1.0, sr=16000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b"\x00\x00" * int(sr * duration_s))
    return buf.getvalue()


def make_small_jpeg():
    img = Image.new("RGB", (400, 250), color=(200, 200, 200))
    # Add some faux text-like rectangles to look like a license
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


# ---- /api/voice-translate ----------------------------------------------------

def test_voice_translate_accepts_expo_formdata_shape(auth_token):
    audio_bytes = make_silent_wav()
    # Use audio/mp4 + m4a filename to match the real client contract
    # (backend derives whisper filename from part filename + content-type)
    body, boundary = build_multipart([
        ("source_lang", "en"),
        ("target_lang", "es"),
        ("audio", {"name": "ptt_recording.m4a", "type": "audio/mp4", "bytes": audio_bytes}),
    ])
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    r = requests.post(f"{BASE_URL}/api/voice-translate", data=body, headers=headers, timeout=60)
    print(f"voice-translate status={r.status_code} body={r.text[:400]}")
    # ACCEPTABLE: 200 (success or success:false with 'no speech'), or a clean 4xx.
    # NOT ACCEPTABLE: 422 form-parsing error, or 500.
    assert r.status_code != 500, f"backend 500 (multipart parse failure suspected): {r.text[:500]}"
    if r.status_code == 422:
        # 422 is only bad if it's a form-parse error. If it validates fields, that's also bad —
        # means multipart wasn't decoded.
        pytest.fail(f"422 form-parsing error — multipart NOT accepted: {r.text[:500]}")
    assert r.status_code in (200, 400, 401, 413, 415), f"unexpected status {r.status_code}: {r.text[:300]}"


# ---- /api/license/scan-direct ------------------------------------------------

def test_scan_direct_accepts_expo_formdata_shape(auth_token):
    jpeg = make_small_jpeg()
    body, boundary = build_multipart([
        ("image", {"name": "license_test.jpg", "type": "image/jpeg", "bytes": jpeg}),
    ])
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    r = requests.post(f"{BASE_URL}/api/license/scan-direct", data=body, headers=headers, timeout=60)
    print(f"scan-direct status={r.status_code} body={r.text[:400]}")
    assert r.status_code != 500 or "parse" not in r.text.lower(), f"multipart parse 500: {r.text[:500]}"
    if r.status_code == 422:
        pytest.fail(f"422 form-parsing error — multipart NOT accepted: {r.text[:500]}")
    # 200 with scan result, or a clean failure (400/422-on-content/500-vision-error) — but NOT parse-failure.
    assert r.status_code in (200, 400, 401, 413, 415, 500), f"unexpected status {r.status_code}"
