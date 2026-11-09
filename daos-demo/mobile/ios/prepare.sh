#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HERE/WebAssets"
for file in "$HERE"/../../driver/*; do
  case "$file" in */jobs.json) continue;; esac
  cp "$file" "$HERE/WebAssets/"
done
