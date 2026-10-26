"""
OmniAI Python sidecar — local execution arm.

This FastAPI service is a laptop-only companion to the Next.js app in
omniai/. It never replaces cloud dispatch. It only:

  - reports CPU / memory / disk (read-only)
  - terminates a local process AFTER a human confirms the command

Bind it to 127.0.0.1 so it is not reachable from the LAN.

Start from this folder:

    python -m venv .venv
    .venv\\Scripts\\activate
    pip install -r requirements.txt
    copy .env.example .env   (then set SIDECAR_SHARED_SECRET)
    python main.py
"""

from __future__ import annotations

import os
import secrets
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, model_validator

from approval import require_os_command_approval, store as approval_store
from events import recent_events, subscribe
from system_tools import collect_diagnostics, find_target, terminate_processes

load_dotenv()

SIDECAR_HOST = os.getenv("SIDECAR_HOST", "127.0.0.1")
SIDECAR_PORT = int(os.getenv("SIDECAR_PORT", "8765"))
SIDECAR_SHARED_SECRET = os.getenv("SIDECAR_SHARED_SECRET", "").strip()

# Loopback-only CORS: the Next.js app on this laptop may call us.
# Browsers should normally go through the Next.js API instead of Python.
ALLOWED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]

app = FastAPI(
    title="OmniAI Python Sidecar",
    description="Local execution arm with a mandatory human approval loop for OS commands.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-OmniAI-Sidecar-Key"],
)


def _is_loopback_host(host_header: Optional[str]) -> bool:
    hostname = (host_header or "").split(":")[0].strip().lower()
    return hostname in {"127.0.0.1", "localhost"}


async def require_local_sidecar_key(
    request: Request,
    x_omniai_sidecar_key: Optional[str] = Header(default=None, alias="X-OmniAI-Sidecar-Key"),
) -> None:
    """
    Two gates, matching the Next.js local routes:

    1. The request Host must be loopback.
    2. The caller must present the shared sidecar secret.
    """
    if not _is_loopback_host(request.headers.get("host")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The OmniAI sidecar only accepts loopback requests.",
        )

    if not SIDECAR_SHARED_SECRET or SIDECAR_SHARED_SECRET == "replace-with-a-long-random-secret":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SIDECAR_SHARED_SECRET is not configured.",
        )

    provided = x_omniai_sidecar_key or ""
    # secrets.compare_digest avoids easy timing leaks when lengths match.
    if len(provided) != len(SIDECAR_SHARED_SECRET) or not secrets.compare_digest(
        provided, SIDECAR_SHARED_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid sidecar key.",
        )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    """Keep 202 pending-approval payloads easy for the TypeScript client to read."""
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.get("/health")
async def health() -> Dict[str, Any]:
    """Unauthenticated liveness check. Does not run OS commands."""
    return {"ok": True, "service": "omniai-python-sidecar", "host": SIDECAR_HOST}


@app.get("/api/system/diagnostics", dependencies=[Depends(require_local_sidecar_key)])
async def system_diagnostics() -> Dict[str, Any]:
    """
    Gather CPU, memory, and disk stats with psutil.

    No subprocess is used, so the approval loop is not required. If you later
    add a diagnostic that shells out (for example `systeminfo`), wrap that
    path with require_os_command_approval() before calling subprocess.
    """
    return {"ok": True, "diagnostics": collect_diagnostics()}


class TaskKillRequest(BaseModel):
    """Body for POST /api/system/taskkill."""

    pid: Optional[int] = Field(default=None, description="Numeric process id to terminate.")
    name: Optional[str] = Field(default=None, description="Exact process name, e.g. notepad.exe")
    force: bool = Field(default=False, description="If true, use kill() instead of terminate().")
    approved: bool = Field(
        default=False,
        description="Must be true on the second request, after a human confirms the ticket.",
    )
    approval_id: Optional[str] = Field(
        default=None,
        description="Ticket id returned by the first (pending) request.",
    )

    @model_validator(mode="after")
    def pid_or_name(self) -> "TaskKillRequest":
        if (self.pid is None and not self.name) or (self.pid is not None and self.name):
            raise ValueError("Provide exactly one of pid or name.")
        return self


@app.post("/api/system/taskkill", dependencies=[Depends(require_local_sidecar_key)])
async def system_taskkill(body: TaskKillRequest) -> Dict[str, Any]:
    """
    Safely terminate a local process, but only after human approval.

    Typical flow from the Next.js backend:

    1. POST { "name": "notepad.exe" }
       -> 202 pending_approval + approval_id
    2. Human reviews the pending event
    3. POST { "name": "notepad.exe", "approved": true, "approval_id": "..." }
       -> process is terminated with psutil (never via a shell string)
    """
    try:
        targets = find_target(body.pid, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Freeze the exact target list into the ticket so the second request
    # cannot silently retarget a different process.
    # Include the resolved pid/name so the human sees the real target.
    # Sort by pid so the approval fingerprint stays stable across retries.
    resolved = sorted(
        ({"pid": proc.pid, "name": proc.name()} for proc in targets),
        key=lambda item: item["pid"],
    )
    details = {
        "pid": body.pid,
        "name": body.name,
        "force": body.force,
        "resolved": resolved,
    }

    require_os_command_approval(
        action="taskkill",
        details=details,
        approved=body.approved,
        approval_id=body.approval_id,
    )

    # Re-resolve after approval in case the process exited while waiting.
    try:
        targets = find_target(body.pid, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    outcome = terminate_processes(targets, force=body.force)
    return {"ok": True, "taskkill": outcome}


@app.get("/api/system/approvals/{approval_id}", dependencies=[Depends(require_local_sidecar_key)])
async def get_approval(approval_id: str) -> Dict[str, Any]:
    ticket = approval_store.get(approval_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="That approval ticket does not exist.")
    return {
        "id": ticket.id,
        "action": ticket.action,
        "details": ticket.details,
        "status": ticket.status,
        "expires_at": ticket.expires_at,
    }


@app.post("/api/system/approvals/{approval_id}/reject", dependencies=[Depends(require_local_sidecar_key)])
async def reject_approval(approval_id: str) -> Dict[str, Any]:
    ticket = approval_store.reject(approval_id)
    return {"ok": True, "id": ticket.id, "status": ticket.status}


@app.get("/api/system/events", dependencies=[Depends(require_local_sidecar_key)])
async def list_events() -> Dict[str, Any]:
    """Recent pending/executed/rejected OS-command events (non-streaming)."""
    return {"ok": True, "events": recent_events()}


@app.get("/api/system/events/stream", dependencies=[Depends(require_local_sidecar_key)])
async def stream_events() -> StreamingResponse:
    """Server-Sent Events feed of approval-loop broadcasts."""
    return StreamingResponse(subscribe(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    if SIDECAR_HOST not in {"127.0.0.1", "localhost"}:
        raise SystemExit("Refusing to start: SIDECAR_HOST must be 127.0.0.1 or localhost.")

    uvicorn.run(
        "main:app",
        host=SIDECAR_HOST,
        port=SIDECAR_PORT,
        reload=False,
    )
