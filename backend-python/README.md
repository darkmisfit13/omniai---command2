# OmniAI Python sidecar

Laptop-only FastAPI service that acts as OmniAI's local execution arm. It
sits next to the Next.js app in `omniai/` and is never deployed to Vercel.

- `GET /api/system/diagnostics` — CPU, memory, disk (psutil, no shell)
- `POST /api/system/taskkill` — terminate a PID/name only after `approved=true`
- `GET /api/system/events/stream` — SSE broadcast of pending OS commands

## Run

```bat
cd backend-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `SIDECAR_SHARED_SECRET` in `.env` to a long random value. Put the same
value in `omniai/.env.local` as `PYTHON_SIDECAR_SECRET`.

```bat
python main.py
```

The process binds `127.0.0.1:8765`. The Next.js owner-authenticated proxy is
`/api/system-sidecar`.
