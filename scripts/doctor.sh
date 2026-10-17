#!/usr/bin/env bash
# Vaultix environment diagnostics (issue #847).
#
# Usage: scripts/doctor.sh [--json]
# Works on Linux and macOS. On Windows, run under WSL or Git Bash.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
JSON_OUTPUT=0

if [ "$#" -gt 1 ]; then
  printf 'doctor: too many arguments\n' >&2
  printf 'Usage: scripts/doctor.sh [--json]\n' >&2
  exit 2
fi

if [ "$#" -eq 1 ]; then
  case "$1" in
    --json) JSON_OUTPUT=1 ;;
    -h | --help)
      printf 'Usage: scripts/doctor.sh [--json]\n'
      exit 0
      ;;
    *)
      printf 'doctor: unknown option: %s\n' "$1" >&2
      printf 'Usage: scripts/doctor.sh [--json]\n' >&2
      exit 2
      ;;
  esac
fi

cd "$REPO_ROOT"

declare -a CHECK_NAMES=()
declare -a CHECK_STATUSES=()
declare -a CHECK_DETAILS=()
FAILURES=0
WARNINGS=0
PASSES=0

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "$JSON_OUTPUT" -eq 0 ]; then
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  RESET=$'\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  RESET=''
fi

record_check() {
  local status="$1" name="$2" details="$3" color=''

  CHECK_NAMES+=("$name")
  CHECK_STATUSES+=("$status")
  CHECK_DETAILS+=("$details")

  case "$status" in
    pass) PASSES=$((PASSES + 1)); color="$GREEN" ;;
    warn) WARNINGS=$((WARNINGS + 1)); color="$YELLOW" ;;
    fail) FAILURES=$((FAILURES + 1)); color="$RED" ;;
  esac

  if [ "$JSON_OUTPUT" -eq 0 ]; then
    printf '%s[%s]%s %s: %s\n' "$color" "$(printf '%s' "$status" | tr '[:lower:]' '[:upper:]')" "$RESET" "$name" "$details"
  fi
}

json_escape() {
  local value="$1"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  printf '%s' "$value"
}

env_files=(
  "$REPO_ROOT/.env"
  "$REPO_ROOT/.env.local"
  "$REPO_ROOT/apps/backend/.env"
  "$REPO_ROOT/apps/frontend/.env"
  "$REPO_ROOT/apps/frontend/.env.local"
  "$REPO_ROOT/apps/mobile/.env"
)

env_value_is_set() {
  local variable="$1" file
  local process_value="${!variable:-}"

  if [ -n "$process_value" ]; then
    return 0
  fi

  for file in "${env_files[@]}"; do
    [ -f "$file" ] || continue
    if awk -v key="$variable" '
      {
        line = $0
        sub(/^[[:space:]]*/, "", line)
        if (line ~ /^#/) next
        sub(/^export[[:space:]]+/, "", line)
        separator = index(line, "=")
        if (!separator) next
        name = substr(line, 1, separator - 1)
        gsub(/[[:space:]]/, "", name)
        if (name != key) next
        value = substr(line, separator + 1)
        sub(/[[:space:]]+#.*/, "", value)
        sub(/^[[:space:]]*/, "", value)
        sub(/[[:space:]]*$/, "", value)
        if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
          value = substr(value, 2, length(value) - 2)
        }
        if (length(value) > 0) found = 1
      }
      END { exit(found ? 0 : 1) }
    ' "$file"; then
      return 0
    fi
  done

  return 1
}

check_command() {
  local command_name="$1" label="$2" required="$3" version=''

  if command -v "$command_name" >/dev/null 2>&1; then
    version="$("$command_name" --version 2>/dev/null | head -n 1 || true)"
    [ -n "$version" ] || version='installed (version unavailable)'
    record_check pass "$label" "$version"
  elif [ "$required" -eq 1 ]; then
    record_check fail "$label" 'not installed'
  else
    record_check warn "$label" 'not installed (optional)'
  fi
}

check_node() {
  local version major

  if ! command -v node >/dev/null 2>&1; then
    record_check fail 'Node.js' 'not installed (version 20 or newer is required)'
    return
  fi

  version="$(node --version 2>/dev/null || true)"
  major="${version#v}"
  major="${major%%.*}"
  if [[ "$major" =~ ^[0-9]+$ ]] && [ "$major" -ge 20 ]; then
    record_check pass 'Node.js' "$version"
  else
    record_check fail 'Node.js' "$version (version 20 or newer is required)"
  fi
}

check_stellar_cli() {
  local cli version

  for cli in stellar soroban; do
    if command -v "$cli" >/dev/null 2>&1; then
      version="$("$cli" --version 2>/dev/null | head -n 1 || true)"
      [ -n "$version" ] || version='installed (version unavailable)'
      record_check pass 'Stellar/Soroban CLI' "$cli $version"
      return
    fi
  done

  record_check fail 'Stellar/Soroban CLI' 'not installed (install stellar or soroban CLI)'
}

check_env_var() {
  local variable="$1"

  if env_value_is_set "$variable"; then
    record_check pass "Environment: $variable" 'configured'
  else
    record_check fail "Environment: $variable" 'missing or empty (process environment and local .env files checked)'
  fi
}

check_port() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      record_check warn "Port $port" 'in use'
    else
      record_check pass "Port $port" 'available'
    fi
  elif command -v nc >/dev/null 2>&1; then
    if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      record_check warn "Port $port" 'in use'
    else
      record_check pass "Port $port" 'available'
    fi
  else
    record_check warn "Port $port" 'cannot check (install lsof or nc)'
  fi
}

check_node
check_command npm npm 1
check_command pnpm pnpm 0
check_command rustc rustc 1
check_stellar_cli
check_command docker Docker 0

check_env_var JWT_SECRET
check_env_var STELLAR_NETWORK
check_env_var WALLET_SECRET
check_env_var NEXT_PUBLIC_API_BASE_URL

check_port 3000
check_port 3001
check_port 5432

if [ "$JSON_OUTPUT" -eq 1 ]; then
  printf '{"checks":['
  for index in "${!CHECK_NAMES[@]}"; do
    [ "$index" -eq 0 ] || printf ','
    printf '{"name":"%s","status":"%s","details":"%s"}' \
      "$(json_escape "${CHECK_NAMES[$index]}")" \
      "$(json_escape "${CHECK_STATUSES[$index]}")" \
      "$(json_escape "${CHECK_DETAILS[$index]}")"
  done
  printf '],"summary":{"pass":%d,"warn":%d,"fail":%d}}\n' "$PASSES" "$WARNINGS" "$FAILURES"
else
  printf '\nSummary: %d passed, %d warnings, %d failed.\n' "$PASSES" "$WARNINGS" "$FAILURES"
fi

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi