"""
Human-in-the-loop approval for any OS-level command.

How the loop works (beginner walkthrough)
-----------------------------------------
HTTP cannot safely "pause" a request forever while a person thinks. Instead
this sidecar uses an explicit two-step protocol:

1. First call (approved is missing/false)
   - The command does NOT run.
   - A pending ticket is stored in memory.
   - A "pending" event is broadcast to SSE listeners.
   - The API returns HTTP 202 with the ticket id.

2. Second call (approved=true AND the same approval_id)
   - The sidecar checks that the ticket still exists, is pending, has not
     expired, and describes the SAME command (pid/name cannot be swapped).
   - Only then does the original endpoint continue into subprocess/psutil.

This matches OmniAI's existing Next.js pattern: local file edits already
require an explicit approve-edit action before anything is written.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from fastapi import HTTPException, status

from events import broadcast


def _approval_ttl_seconds() -> int:
    raw = os.getenv("APPROVAL_TTL_SECONDS", "900")
    try:
        value = int(raw)
    except ValueError:
        value = 900
    return max(60, min(value, 3600))


def canonical_command_hash(action: str, details: Dict[str, Any]) -> str:
    """
    Fingerprint of the exact command the human is approving.

    If a later request tries to reuse an approval_id with a different pid
    or process name, the hashes will not match and execution is refused.
    """
    blob = json.dumps({"action": action, "details": details}, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


@dataclass
class ApprovalTicket:
    id: str
    action: str
    details: Dict[str, Any]
    command_hash: str
    status: str = "pending"  # pending | approved | rejected | expired | executed
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    event: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class ApprovalStore:
    """Tiny in-memory ticket desk. Fine for a laptop sidecar; not a database."""

    def __init__(self) -> None:
        self._tickets: Dict[str, ApprovalTicket] = {}

    def create(self, action: str, details: Dict[str, Any]) -> ApprovalTicket:
        self.purge_expired()
        command_hash = canonical_command_hash(action, details)
        ticket_id = str(uuid.uuid4())
        ttl = _approval_ttl_seconds()
        ticket = ApprovalTicket(
            id=ticket_id,
            action=action,
            details=details,
            command_hash=command_hash,
            expires_at=time.time() + ttl,
        )
        ticket.event = broadcast(
            "os_command.pending",
            {
                "approval_id": ticket.id,
                "action": ticket.action,
                "details": ticket.details,
                "expires_in_seconds": ttl,
                "message": (
                    "OmniAI halted a local OS command. Re-submit the same "
                    "request with approved=true and this approval_id to run it."
                ),
            },
        )
        self._tickets[ticket.id] = ticket
        return ticket

    def get(self, ticket_id: str) -> Optional[ApprovalTicket]:
        ticket = self._tickets.get(ticket_id)
        if ticket and ticket.is_expired() and ticket.status == "pending":
            ticket.status = "expired"
        return ticket

    def consume_for_execution(self, ticket_id: str, action: str, details: Dict[str, Any]) -> ApprovalTicket:
        """
        Mark a pending ticket as used. Raises HTTPException on any mismatch.
        """
        ticket = self.get(ticket_id)
        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="That approval ticket does not exist. Request the command again.",
            )
        if ticket.status == "expired" or ticket.is_expired():
            ticket.status = "expired"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That approval ticket expired. Request the command again.",
            )
        if ticket.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="That OS command was rejected and will not run.",
            )
        if ticket.status == "executed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That approval was already used. Request a new ticket.",
            )
        if ticket.status != "pending" and ticket.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This ticket is {ticket.status} and cannot be executed.",
            )

        expected = canonical_command_hash(action, details)
        if expected != ticket.command_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The approved command does not match this ticket. Start over.",
            )

        ticket.status = "executed"
        broadcast(
            "os_command.executed",
            {"approval_id": ticket.id, "action": ticket.action, "details": ticket.details},
        )
        return ticket

    def reject(self, ticket_id: str) -> ApprovalTicket:
        ticket = self.get(ticket_id)
        if ticket is None:
            raise HTTPException(status_code=404, detail="That approval ticket does not exist.")
        if ticket.status not in ("pending", "approved"):
            raise HTTPException(status_code=409, detail=f"This ticket is {ticket.status}.")
        ticket.status = "rejected"
        broadcast("os_command.rejected", {"approval_id": ticket.id, "action": ticket.action})
        return ticket

    def purge_expired(self) -> None:
        now = time.time()
        expired_ids = [
            ticket_id
            for ticket_id, ticket in self._tickets.items()
            if ticket.status == "pending" and now > ticket.expires_at
        ]
        for ticket_id in expired_ids:
            self._tickets[ticket_id].status = "expired"


# One store for the whole sidecar process.
store = ApprovalStore()


def require_os_command_approval(
    *,
    action: str,
    details: Dict[str, Any],
    approved: bool = False,
    approval_id: Optional[str] = None,
) -> ApprovalTicket:
    """
    Halt any OS-level command until a human confirms it.

    Call this at the top of every endpoint that would spawn a subprocess
    or terminate a process. Example:

        ticket = require_os_command_approval(
            action="taskkill",
            details={"pid": 1234},
            approved=body.approved,
            approval_id=body.approval_id,
        )
        # If we reached this line, a human already said yes.
    """
    if approved:
        if not approval_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="approved=true requires the approval_id from the pending ticket.",
            )
        return store.consume_for_execution(approval_id, action, details)

    ticket = store.create(action, details)
    raise HTTPException(
        status_code=status.HTTP_202_ACCEPTED,
        detail={
            "status": "pending_approval",
            "approval_id": ticket.id,
            "action": ticket.action,
            "details": ticket.details,
            "expires_at": ticket.expires_at,
            "event": ticket.event,
            "next_step": (
                "Re-submit this request with the same body plus "
                f'approved=true and approval_id="{ticket.id}".'
            ),
        },
    )
