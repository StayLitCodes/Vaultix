#!/usr/bin/env bash
#
# Vaultix API smoke test / post-deploy health verification (issue #861).
#
# Waits for the API to become healthy, then exercises a small set of read-only
# and auth endpoints, checking both the HTTP status code and the response
# latency. Prints a readable summary and exits non-zero if any check fails.
#
# Usage:
#   scripts/smoke-test.sh [BASE_URL] [options]
#   BASE_URL=https://api.staging.example ./scripts/smoke-test.sh
#
# Options:
#   -u, --url URL          API base URL (default: $BASE_URL, else http://127.0.0.1:3000)
#   -t, --timeout SEC      Per-request timeout in seconds (default: 5)
#   -r, --retries N        Readiness attempts while the API boots (default: 30)
#   -d, --delay SEC        Delay between readiness attempts (default: 2)
#   -m, --max-latency SEC  Flag checks slower than this as SLOW (default: 2)
#       --skip-readiness   Do not wait for /health before running the checks
#   -h, --help             Show this help
#
# Environment:
#   BASE_URL                Same as --url
#   SMOKE_STELLAR_ADDRESS   Stellar public key used by the auth-nonce check
#   NO_COLOR                Disable coloured output
#
# Notes:
#   * Requires `curl`.
#   * Works on Linux and macOS. On Windows, run under WSL or Git Bash.
#
# Exit codes: 0 = all checks passed; 1 = one or more checks failed; 2 = usage error.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TIMEOUT=5
RETRIES=30
DELAY=2
MAX_LATENCY=2
WAIT_FOR_READY=1
# A checksum-valid Stellar public key; any well-formed address is accepted by
# the challenge endpoint, so this does not need to be a funded account.
STELLAR_ADDRESS="${SMOKE_STELLAR_ADDRESS:-GCIWOXPRFS7LS2XPKYTTCEMV6K44LZXLFTX6XX7HLVCYE7PNVFBXP3ZE}"

usage() {
  sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -u | --url) BASE_URL="${2:?-u/--url requires a value}"; shift 2 ;;
    -t | --timeout) TIMEOUT="${2:?-t/--timeout requires a value}"; shift 2 ;;
    -r | --retries) RETRIES="${2:?-r/--retries requires a value}"; shift 2 ;;
    -d | --delay) DELAY="${2:?-d/--delay requires a value}"; shift 2 ;;
    -m | --max-latency) MAX_LATENCY="${2:?-m/--max-latency requires a value}"; shift 2 ;;
    --skip-readiness) WAIT_FOR_READY=0; shift ;;
    -h | --help) usage; exit 0 ;;
    http://* | https://*) BASE_URL="$1"; shift ;;
    *)
      echo "smoke-test: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done
BASE_URL="${BASE_URL%/}"

if ! command -v curl >/dev/null 2>&1; then
  echo "smoke-test: curl is required but was not found on PATH." >&2
  exit 2
fi

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_RED='' C_GREEN='' C_YELLOW='' C_BOLD='' C_RESET=''
fi

BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/vaultix-smoke.XXXXXX")"
trap 'rm -f "$BODY_FILE"' EXIT

# request METHOD PATH [JSON_BODY] -> sets $CODE and $TIME.
request() {
  local method="$1" path="$2" data="${3:-}" url meta
  url="${BASE_URL}${path}"
  if [ -n "$data" ]; then
    meta="$(curl -sS -o "$BODY_FILE" -w '%{http_code} %{time_total}' --max-time "$TIMEOUT" \
      -X "$method" -H 'Content-Type: application/json' -d "$data" "$url" 2>/dev/null || true)"
  else
    meta="$(curl -sS -o "$BODY_FILE" -w '%{http_code} %{time_total}' --max-time "$TIMEOUT" \
      -X "$method" "$url" 2>/dev/null || true)"
  fi
  CODE="${meta%% *}"
  TIME="${meta##* }"
  [ -n "$CODE" ] || CODE="000"
  [ -n "$TIME" ] || TIME="0"
}

wait_for_ready() {
  printf 'Waiting for %s to become healthy' "$BASE_URL"
  local attempt=0
  while [ "$attempt" -lt "$RETRIES" ]; do
    request GET /health
    if [ "$CODE" = "200" ]; then
      printf ' (after %s attempt(s)).\n' "$((attempt + 1))"
      return 0
    fi
    printf '.'
    attempt=$((attempt + 1))
    sleep "$DELAY"
  done
  printf '\n'
  printf '%sAPI at %s did not become healthy after %s attempt(s).%s\n' \
    "$C_RED" "$BASE_URL" "$RETRIES" "$C_RESET" >&2
  return 1
}

TOTAL=0
PASSED=0
FAILED=0
SLOW=0

# check NAME METHOD PATH [JSON_BODY]
check() {
  local name="$1" method="$2" path="$3" data="${4:-}"
  local tag=''
  TOTAL=$((TOTAL + 1))
  request "$method" "$path" "$data"

  if awk "BEGIN{exit !($TIME > $MAX_LATENCY)}"; then
    tag=" ${C_YELLOW}SLOW${C_RESET}"
    SLOW=$((SLOW + 1))
  fi

  if [ "$CODE" = "200" ]; then
    PASSED=$((PASSED + 1))
    printf '  %sPASS%s  %-38s %s  %ss%s\n' "$C_GREEN" "$C_RESET" "$name" "$CODE" "$TIME" "$tag"
  else
    FAILED=$((FAILED + 1))
    printf '  %sFAIL%s  %-38s %s  %ss%s\n' "$C_RED" "$C_RESET" "$name" "$CODE" "$TIME" "$tag"
    printf '        expected 200, body: %s\n' "$(head -c 280 "$BODY_FILE" | tr '\n' ' ')"
  fi
}

printf '%sVaultix API smoke test%s\n' "$C_BOLD" "$C_RESET"
printf 'Target: %s\n' "$BASE_URL"

if [ "$WAIT_FOR_READY" -eq 1 ]; then
  if ! wait_for_ready; then
    printf 'Summary: 0/0 checks run (API never became healthy).\n' >&2
    exit 1
  fi
fi

check "GET /health" GET /health
check "GET /health/live" GET /health/live
check "GET /health/info" GET /health/info
check "GET /health/database" GET /health/database
check "GET /v1/api/app/version" GET /v1/api/app/version
check "POST /v1/auth/challenge" POST /v1/auth/challenge "{\"walletAddress\":\"$STELLAR_ADDRESS\"}"

printf '\nSummary: %s/%s checks passed' "$PASSED" "$TOTAL"
if [ "$SLOW" -gt 0 ]; then
  printf ', %s slow (>%ss)' "$SLOW" "$MAX_LATENCY"
fi
printf '.\n'

if [ "$FAILED" -gt 0 ]; then
  printf '%sSmoke test FAILED (%s check(s) failed).%s\n' "$C_RED" "$FAILED" "$C_RESET" >&2
  exit 1
fi

printf '%sSmoke test passed.%s\n' "$C_GREEN" "$C_RESET"
