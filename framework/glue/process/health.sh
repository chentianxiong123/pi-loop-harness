#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
ADDR="${HARNESSD_ADDR:-:8100}"
HOST="${ADDR%:*}"
PORT="${ADDR##*:}"
curl -fsS "http://${HOST:-127.0.0.1}:$PORT/api/count"
echo " <- healthy"