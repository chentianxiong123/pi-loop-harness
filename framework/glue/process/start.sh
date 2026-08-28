#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
make build
BIN=bin/harnessd
ADDR="${HARNESSD_ADDR:-:8100}"
nohup ./"$BIN" > data/harnessd.log 2>&1 &
echo $! > data/harnessd.pid
echo "started harnessd on $ADDR (pid $(cat data/harnessd.pid))"