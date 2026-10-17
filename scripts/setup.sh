#!/usr/bin/env bash
# Vaultix monorepo bootstrap (issue #846).
#
# Usage: scripts/setup.sh [--with-db]
# Works on Linux and macOS. On Windows, use WSL or Git Bash with tools on PATH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/apps/backend/docker-compose.yml"
WITH_DB=0

usage() {
  printf 'Usage: scripts/setup.sh [--with-db]\n'
  printf '  --with-db  Start local PostgreSQL and run backend migrations\n'
  printf '  -h, --help Show this help\n'
}

for argument in "$@"; do
  case "$argument" in
    --with-db) WITH_DB=1 ;;
    -h | --help) usage; exit 0 ;;
    *)
      printf 'setup: unknown option: %s\n' "$argument" >&2
      usage >&2
      exit 2
      ;;
  esac
done

fail() {
  printf 'setup: error: %s\n' "$1" >&2
  exit 1
}

check_node_and_npm() {
  local node_version node_major npm_version npm_major

  command -v node >/dev/null 2>&1 || fail 'Node.js 20+ is required. Install it from https://nodejs.org.'
  command -v npm >/dev/null 2>&1 || fail 'npm 10+ is required. Vaultix uses npm; pnpm is not supported.'

  node_version="$(node --version 2>/dev/null || true)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  if [[ ! "$node_major" =~ ^[0-9]+$ ]] || [ "$node_major" -lt 20 ]; then
    fail "Node.js 20+ is required; found '${node_version:-unknown}'."
  fi

  npm_version="$(npm --version 2>/dev/null || true)"
  npm_major="${npm_version%%.*}"
  if [[ ! "$npm_major" =~ ^[0-9]+$ ]] || [ "$npm_major" -lt 10 ]; then
    fail "npm 10+ is required; found '${npm_version:-unknown}'."
  fi

  printf 'setup: using Node.js %s and npm %s.\n' "$node_version" "$npm_version"
  if command -v pnpm >/dev/null 2>&1; then
    printf 'setup: pnpm is installed but will not be used; this repository uses npm.\n'
  fi
}

check_optional_tools() {
  if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
    printf 'setup: Rust toolchain found (%s).\n' "$(rustc --version)"
  else
    printf 'setup: warning: Rust/Cargo not found; contract development will need Rust from https://rustup.rs.\n' >&2
  fi

  if [ "$WITH_DB" -eq 1 ]; then
    command -v docker >/dev/null 2>&1 || fail 'Docker is required with --with-db. Install Docker Desktop or Docker Engine.'
    docker compose version >/dev/null 2>&1 || fail 'Docker Compose plugin is required with --with-db (try: docker compose version).'
  elif ! command -v docker >/dev/null 2>&1; then
    printf 'setup: note: Docker not found; PostgreSQL will not be started. Use --with-db when Docker Compose is available.\n'
  elif ! docker compose version >/dev/null 2>&1; then
    printf 'setup: note: Docker Compose plugin not found; PostgreSQL will not be started.\n'
  fi
}

copy_env_file() {
  local example="$1" target="$2"

  if [ -f "$target" ]; then
    printf 'setup: keeping existing %s.\n' "${target#"$REPO_ROOT/"}"
  elif [ -f "$example" ]; then
    cp "$example" "$target"
    printf 'setup: copied %s to %s.\n' "${example#"$REPO_ROOT/"}" "${target#"$REPO_ROOT/"}"
  else
    printf 'setup: no %s template; skipping.\n' "${example#"$REPO_ROOT/"}"
  fi
}

install_dependencies() {
  local directory="$1"
  printf 'setup: installing dependencies in %s.\n' "${directory#"$REPO_ROOT/"}"
  (cd "$directory" && npm install)
}

start_database_and_migrate() {
  local attempt=0

  printf 'setup: starting local PostgreSQL.\n'
  docker compose -f "$COMPOSE_FILE" up -d postgres

  printf 'setup: waiting for PostgreSQL to become ready.\n'
  until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U vaultix_user -d vaultix_db >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      fail 'PostgreSQL did not become ready within 60 seconds.'
    fi
    sleep 2
  done

  printf 'setup: running backend migrations against the local Compose database.\n'
  DATABASE_URL='postgresql://vaultix_user:vaultix_pass@127.0.0.1:5432/vaultix_db' \
    npm --prefix "$REPO_ROOT/apps/backend" run migration:run
}

cd "$REPO_ROOT"
check_node_and_npm
check_optional_tools

copy_env_file "$REPO_ROOT/apps/backend/.env.example" "$REPO_ROOT/apps/backend/.env"
copy_env_file "$REPO_ROOT/apps/frontend/.env.example" "$REPO_ROOT/apps/frontend/.env"
copy_env_file "$REPO_ROOT/apps/mobile/.env.example" "$REPO_ROOT/apps/mobile/.env"

install_dependencies "$REPO_ROOT"
install_dependencies "$REPO_ROOT/apps/backend"
install_dependencies "$REPO_ROOT/apps/frontend"
install_dependencies "$REPO_ROOT/apps/mobile"

if [ "$WITH_DB" -eq 1 ]; then
  start_database_and_migrate
fi

printf 'setup: complete. Review local .env files before starting the apps.\n'