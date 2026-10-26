"""
Lightweight checks for the sidecar approval loop.

Run from backend-python after installing requirements:

    python test_sidecar.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

os.environ["SIDECAR_SHARED_SECRET"] = "test-sidecar-secret-value"
os.environ["SIDECAR_HOST"] = "127.0.0.1"

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


HEADERS = {
    "X-OmniAI-Sidecar-Key": "test-sidecar-secret-value",
    "Host": "127.0.0.1:8765",
}


def main() -> None:
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["ok"] is True

    denied = client.get("/api/system/diagnostics", headers={"Host": "127.0.0.1:8765"})
    assert denied.status_code == 401, denied.text

    diagnostics = client.get("/api/system/diagnostics", headers=HEADERS)
    assert diagnostics.status_code == 200, diagnostics.text
    payload = diagnostics.json()
    assert payload["ok"] is True
    assert "cpu" in payload["diagnostics"]
    assert "memory" in payload["diagnostics"]
    assert "disk" in payload["diagnostics"]

    missing = client.post(
        "/api/system/taskkill",
        headers=HEADERS,
        json={"pid": 1_000_000_007},
    )
    assert missing.status_code == 400, missing.text

    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    try:
        time.sleep(0.4)
        pending = client.post(
            "/api/system/taskkill",
            headers=HEADERS,
            json={"pid": child.pid},
        )
        assert pending.status_code == 202, pending.text
        ticket = pending.json()["error"]
        assert ticket["status"] == "pending_approval"
        assert ticket["approval_id"]
        assert child.poll() is None, "Process was killed before human approval."

        approved = client.post(
            "/api/system/taskkill",
            headers=HEADERS,
            json={
                "pid": child.pid,
                "approved": True,
                "approval_id": ticket["approval_id"],
            },
        )
        assert approved.status_code == 200, approved.text
        body = approved.json()
        assert body["ok"] is True
        assert body["taskkill"]["terminated"] == 1
        child.wait(timeout=5)
    finally:
        if child.poll() is None:
            child.kill()

    print("sidecar checks passed")


if __name__ == "__main__":
    main()
