#!/usr/bin/env bash
# Compatibility wrapper. The verifier is Node-based so Windows and CI do not
# interpolate credentials through shell commands.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/rls-smoke-test.mjs"
