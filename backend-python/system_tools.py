"""
Safe local system helpers for OmniAI.

Diagnostics use psutil only (no shell). Task termination also uses psutil
so user-supplied names/PIDs are never concatenated into a command string.
"""

from __future__ import annotations

import os
import platform
import re
from typing import Any, Dict, List, Optional, Tuple

import psutil


# Process names that this sidecar will never terminate, even if approved.
# These are core OS / session processes. Expand this list as needed.
PROTECTED_PROCESS_NAMES = {
    "system",
    "idle",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "explorer.exe",
    "registry",
    "memory compression",
    "secure system",
    "init",
    "systemd",
    "launchd",
    "kernel_task",
}

SAFE_PROCESS_NAME = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def collect_diagnostics() -> Dict[str, Any]:
    """
    Read-only CPU, memory, and disk snapshot.

    This function never starts a subprocess. It is safe to expose without
    the approval loop because it cannot change the machine.
    """
    # interval>0 samples CPU over a short window so the value is meaningful.
    cpu_percent = psutil.cpu_percent(interval=0.05)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    memory = psutil.virtual_memory()
    disk_path = os.environ.get("SystemDrive", "C:") + "\\" if os.name == "nt" else "/"
    disk = psutil.disk_usage(disk_path)

    return {
        "host": platform.node(),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "python": platform.python_version(),
        },
        "cpu": {
            "percent": cpu_percent,
            "per_cpu_percent": per_cpu,
            "count_logical": psutil.cpu_count(logical=True),
            "count_physical": psutil.cpu_count(logical=False),
        },
        "memory": {
            "total_bytes": memory.total,
            "available_bytes": memory.available,
            "used_bytes": memory.used,
            "percent": memory.percent,
        },
        "disk": {
            "path": disk_path,
            "total_bytes": disk.total,
            "used_bytes": disk.used,
            "free_bytes": disk.free,
            "percent": disk.percent,
        },
        "process": {
            "pid": os.getpid(),
            "name": "omniai-python-sidecar",
        },
    }


def _normalize_name(name: str) -> str:
    value = name.strip()
    if not SAFE_PROCESS_NAME.match(value):
        raise ValueError(
            "Process name may only contain letters, numbers, dots, underscores, and hyphens."
        )
    return value.lower()


def _is_protected(proc: psutil.Process) -> Tuple[bool, str]:
    pid = proc.pid
    if pid in (0, 4) or pid == os.getpid() or pid == os.getppid():
        return True, "OmniAI will not terminate the sidecar, its parent, or kernel PIDs."
    try:
        name = (proc.name() or "").lower()
    except (psutil.Error, OSError):
        name = ""
    if name in PROTECTED_PROCESS_NAMES:
        return True, f"'{name}' is on the protected-process list."
    return False, ""


def _describe(proc: psutil.Process) -> Dict[str, Any]:
    try:
        name = proc.name()
    except (psutil.Error, OSError):
        name = "unknown"
    try:
        exe = proc.exe()
    except (psutil.Error, OSError):
        exe = None
    return {"pid": proc.pid, "name": name, "exe": exe}


def find_target(pid: Optional[int], name: Optional[str]) -> List[psutil.Process]:
    """
    Resolve exactly which processes a taskkill request would affect.

    Call this BEFORE the approval loop so the pending ticket shows the
    human the real pid/name, not a guess.
    """
    if pid is None and not name:
        raise ValueError("Provide a pid or a process name.")
    if pid is not None and name:
        raise ValueError("Provide pid or process name, not both.")

    if pid is not None:
        if pid < 1:
            raise ValueError("pid must be a positive integer.")
        try:
            proc = psutil.Process(pid)
            # Access a cheap attribute so we fail early if it already exited.
            proc.status()
        except psutil.NoSuchProcess as exc:
            raise ValueError(f"No process is running with pid {pid}.") from exc
        except psutil.Error as exc:
            raise ValueError(f"Could not inspect pid {pid}: {exc}") from exc
        return [proc]

    wanted = _normalize_name(name or "")
    matches: List[psutil.Process] = []
    for proc in psutil.process_iter(attrs=["pid", "name"]):
        try:
            current = (proc.info.get("name") or "").lower()
        except (psutil.Error, OSError):
            continue
        if current == wanted:
            matches.append(proc)

    if not matches:
        raise ValueError(f"No running process is named '{wanted}'.")
    if len(matches) > 1:
        pids = ", ".join(str(proc.pid) for proc in matches)
        raise ValueError(
            f"Multiple processes are named '{wanted}' (pids: {pids}). "
            "Pass a specific pid instead of a name."
        )
    return matches


def terminate_processes(processes: List[psutil.Process], *, force: bool = False) -> Dict[str, Any]:
    """
    Terminate previously resolved processes. Never takes a raw shell string.
    """
    results = []
    for proc in processes:
        protected, reason = _is_protected(proc)
        snapshot = _describe(proc)
        if protected:
            results.append({**snapshot, "terminated": False, "error": reason})
            continue
        try:
            if force:
                proc.kill()
            else:
                proc.terminate()
            gone, alive = psutil.wait_procs([proc], timeout=3)
            if alive and not force:
                # Soft terminate did not finish; do not escalate automatically.
                results.append({**snapshot, "terminated": False, "error": "Process is still running after terminate(). Re-approve with force=true if you intend to kill it."})
                continue
            if alive and force:
                results.append({**snapshot, "terminated": False, "error": "Process is still running after kill()."})
                continue
            results.append({**snapshot, "terminated": True, "error": None})
        except psutil.Error as exc:
            results.append({**snapshot, "terminated": False, "error": str(exc)})

    return {
        "attempted": len(processes),
        "terminated": sum(1 for item in results if item["terminated"]),
        "results": results,
    }
