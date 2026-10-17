#!/usr/bin/env bash
#
# Vaultix git-hooks bootstrap (issue #854).
#
# Installs the local commit hooks (husky) and reports which optional linters are
# available. Run once after cloning:
#
#   ./scripts/setup-hooks.sh
#
# The root `prepare` script also installs husky automatically on `npm install`,
# so this script only needs to be run explicitly on machines where hooks were
# not installed (for example when `npm install` was run with `--ignore-scripts`).
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! command -v npm >/dev/null 2>&1; then
  echo "setup-hooks: npm is required but was not found on PATH (see README, Node.js 20+)." >&2
  exit 1
fi

echo "setup-hooks: installing root dependencies (the 'prepare' script installs husky)…"
npm install

echo "setup-hooks: installing git hooks…"
npx --no-install husky

missing=()
command -v shellcheck >/dev/null 2>&1 || missing+=("shellcheck")
command -v rustfmt >/dev/null 2>&1 || missing+=("rustfmt")

if [ "${#missing[@]}" -gt 0 ]; then
  echo "setup-hooks: optional tools not found: ${missing[*]}"
  echo "  shellcheck -> https://github.com/koalaman/shellcheck#installing"
  echo "  rustfmt    -> rustup component add rustfmt"
  echo "  (the hook skips checks whose tools are missing)"
fi

echo "setup-hooks: done. Hooks run on 'git commit'; bypass with SKIP_HOOKS=1 or git commit --no-verify."
