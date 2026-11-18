#!/usr/bin/env bash
# Starts Reconcile Core Engine without Docker (Linux, macOS, WSL).
# Requires Python 3.13+ and Node.js 20.19+ on PATH.
# Backend: http://127.0.0.1:8001   UI: http://127.0.0.1:5174
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend="$root/backend"
frontend="$root/frontend"
venv_python="$backend/.venv/bin/python"

python_bin="$(command -v python3 || command -v python || true)"
if [ -z "$python_bin" ]; then
  echo "Python 3.13+ was not found on PATH." >&2
  exit 1
fi
if ! "$python_bin" -c 'import sys; sys.exit(sys.version_info < (3, 13))'; then
  echo "Python 3.13+ is required; found $("$python_bin" --version 2>&1)." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js 20.19+ and try again." >&2
  exit 1
fi

# A previous run may have left a half-built environment behind, for example on
# Debian or Ubuntu without the python3-venv package: the directory exists but
# has no working pip. Testing for the directory alone would keep that broken
# environment forever, so the check is "does pip work" and a broken one is rebuilt.
if ! "$venv_python" -m pip --version >/dev/null 2>&1; then
  echo "Creating Python virtual environment..."
  rm -rf "$backend/.venv"
  if ! "$python_bin" -m venv "$backend/.venv"; then
    rm -rf "$backend/.venv"
    echo "Could not create the virtual environment." >&2
    echo "On Debian or Ubuntu, install it with: sudo apt install python3-venv" >&2
    exit 1
  fi
fi

echo "Installing backend dependencies..."
"$venv_python" -m pip install --quiet --disable-pip-version-check \
  -r "$backend/requirements.txt"

# If something already listens on port 8001, the health check below could be
# answered by that other program, so refuse to start instead.
if "$venv_python" -c 'import socket, sys; s = socket.socket(); s.settimeout(1); sys.exit(s.connect_ex(("127.0.0.1", 8001)))' 2>/dev/null; then
  echo "Port 8001 is already in use. Stop the program using it and run this script again." >&2
  exit 1
fi

echo "Starting backend on http://127.0.0.1:8001 ..."
(
  cd "$backend"
  # One worker only: the batch lives in memory and must be shared by all clients.
  exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 \
    --workers 1 --timeout-graceful-shutdown 3
) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
# Ctrl+C ends the script here (the EXIT trap then stops the backend) instead of
# letting it continue and report a misleading start-up failure.
trap 'exit 130' INT TERM

# Fail fast if the backend did not come up. The process is checked as well as
# the port, and the probe ignores proxy settings: a proxy variable (often set
# so pip can download packages) must not hide a healthy local backend.
startup_seconds=30
health_probe="import urllib.request; urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8001/api/v1/health', timeout=1)"
deadline=$((SECONDS + startup_seconds))
healthy=""
while [ -z "$healthy" ] && [ "$SECONDS" -lt "$deadline" ]; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "The backend stopped during start-up. See its error message above." >&2
    exit 1
  fi
  if "$venv_python" -c "$health_probe" 2>/dev/null; then
    healthy="yes"
  else
    sleep 0.5
  fi
done
if [ -z "$healthy" ]; then
  echo "The backend did not answer on http://127.0.0.1:8001 within $startup_seconds seconds." >&2
  exit 1
fi

cd "$frontend"
# npm writes this marker when an install completes, so an interrupted install
# is repeated instead of being mistaken for a finished one.
if [ ! -f node_modules/.package-lock.json ]; then
  echo "Installing frontend dependencies..."
  npm ci --no-fund --no-audit
fi

echo
echo "Open http://127.0.0.1:5174 in your browser. Press Ctrl+C to stop."
echo
npm run dev
