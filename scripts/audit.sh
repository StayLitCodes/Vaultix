#!/usr/bin/env bash
#
# Vaultix dependency audit (issue #858).
#
# Audits the JavaScript apps with `npm audit` and the Soroban contract with
# `cargo audit`. Exits non-zero when a HIGH or CRITICAL advisory is found, and
# merely warns for lower severities. JSON reports are written to the report
# directory so CI can upload them as an artifact.
#
# Usage:
#   scripts/audit.sh [--js|--rust] [--report-dir DIR]
#
# Options:
#   --js                 Audit the JavaScript apps only
#   --rust               Audit the Rust crate only
#   --report-dir DIR     Directory for JSON reports (default: audit-reports)
#   -h, --help           Show this help
#
# Environment:
#   AUDIT_APPS           Space-separated JS app directories
#                        (default: "apps/backend apps/frontend")
#   AUDIT_RUST_DIR       Rust crate directory (default: apps/onchain)
#
# Notes:
#   * `npm audit` reads the committed package-lock.json, so no install step is
#     required. `cargo audit` needs cargo-audit installed
#     (`cargo install cargo-audit`, or use the taiki-e/install-action in CI).
#   * Works on Linux and macOS. On Windows, run under WSL or Git Bash.
#
# Exit codes: 0 = no high/critical advisories; 1 = high/critical found; 2 = usage error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RUN_JS=1
RUN_RUST=1
REPORT_DIR="audit-reports"
AUDIT_APPS="${AUDIT_APPS:-apps/backend apps/frontend}"
AUDIT_RUST_DIR="${AUDIT_RUST_DIR:-apps/onchain}"
SUMMARISER="$SCRIPT_DIR/audit/summarise.mjs"

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --js) RUN_RUST=0; shift ;;
    --rust) RUN_JS=0; shift ;;
    --report-dir) REPORT_DIR="${2:?--report-dir requires a value}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *)
      echo "audit: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "audit: node is required (used to summarise the reports)." >&2
  exit 2
fi

cd "$REPO_ROOT"
mkdir -p "$REPORT_DIR"
REPORT_DIR_ABS="$(cd "$REPORT_DIR" && pwd)"

FAILED=0

run_js_audit() {
  local app="$1" name report
  name="$(basename "$app")"

  if [ ! -f "$app/package.json" ]; then
    echo "  $name: no package.json - skipping."
    return 0
  fi
  if [ ! -f "$app/package-lock.json" ]; then
    echo "  $name: no package-lock.json - skipping (npm audit needs a lockfile)."
    return 0
  fi

  report="$REPORT_DIR_ABS/$name-npm-audit.json"
  echo "==> npm audit: $app"
  if (cd "$app" && npm audit --json) >"$report" 2>/dev/null; then
    :
  fi

  if ! node "$SUMMARISER" npm "$report"; then
    FAILED=1
  fi
}

run_rust_audit() {
  local dir="$1" name report
  name="$(basename "$dir")"

  if [ ! -f "$dir/Cargo.toml" ]; then
    echo "  $name: no Cargo.toml - skipping."
    return 0
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    echo "  $name: cargo not installed - skipping (install Rust: https://rustup.rs)."
    return 0
  fi
  if ! cargo audit --version >/dev/null 2>&1; then
    echo "  $name: cargo-audit not installed - skipping (cargo install cargo-audit)."
    return 0
  fi

  report="$REPORT_DIR_ABS/$name-cargo-audit.json"
  echo "==> cargo audit: $dir"
  if (cd "$dir" && cargo audit --json) >"$report" 2>/dev/null; then
    :
  fi

  if ! node "$SUMMARISER" cargo "$report"; then
    FAILED=1
  fi
}

echo "Vaultix dependency audit (reports -> $REPORT_DIR)"

if [ "$RUN_JS" -eq 1 ]; then
  # shellcheck disable=SC2086  # AUDIT_APPS is intentionally word-split.
  for app in $AUDIT_APPS; do
    run_js_audit "$app"
  done
fi

if [ "$RUN_RUST" -eq 1 ]; then
  run_rust_audit "$AUDIT_RUST_DIR"
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Dependency audit FAILED: high/critical advisories found." >&2
  exit 1
fi

echo "Dependency audit passed (no high/critical advisories)."
