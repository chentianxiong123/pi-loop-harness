#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
PID_FILE=data/harnessd.pid
if [ ! -f "$PID_FILE" ]; then
    echo "not running (no pid file)" >&2
    exit 0
fi
kill "$(cat "$PID_FILE")" 2>/dev/null || true
rm -f "$PID_FILE"
echo "stopped harnessd"