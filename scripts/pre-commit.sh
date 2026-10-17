#!/usr/bin/env bash
#
# Vaultix pre-commit hook (issue #854) — staged-files-only lint/format checks.
#
# Checks, against the files staged for this commit:
#   * prettier  --check  on staged JS/TS/JSON/Markdown/CSS
#   * eslint             on staged TS/JS, using each app's own config
#   * rustfmt   --check  on staged Rust
#   * shellcheck         on staged shell scripts
#
# Tools that are not installed are skipped with a warning so the hook stays
# usable on a minimal machine. To bypass a run:
#   SKIP_HOOKS=1 git commit …      (or)      git commit --no-verify
#
# Written to run on Linux and macOS (bash 3.2+, no bash-4-only features).
set -euo pipefail

if [ "${SKIP_HOOKS:-0}" = "1" ]; then
  echo "pre-commit: SKIP_HOOKS=1 set — skipping checks."
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

# Collect staged files (added/copied/modified/renamed); deletions are ignored.
staged=()
while IFS= read -r path; do
  if [ -n "$path" ]; then
    staged+=("$path")
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "${#staged[@]}" -eq 0 ]; then
  echo "pre-commit: no staged files — nothing to check."
  exit 0
fi

ts_files=()
js_files=()
rs_files=()
sh_files=()

for path in "${staged[@]}"; do
  if [ ! -f "$path" ]; then
    continue
  fi
  case "$path" in
    *.ts | *.tsx) ts_files+=("$path") ;;
    *.js | *.jsx | *.mjs | *.cjs) js_files+=("$path") ;;
    *.rs) rs_files+=("$path") ;;
    *.sh | *.bash) sh_files+=("$path") ;;
  esac
done

failed=0
note() { printf 'pre-commit: %s\n' "$*"; }
problem() {
  printf 'pre-commit: %s\n' "$*" >&2
  failed=1
}

# --- prettier ---------------------------------------------------------------
run_prettier() {
  local count="$#"
  if [ "$count" -eq 0 ]; then
    return 0
  fi
  if [ -x node_modules/.bin/prettier ]; then
    note "prettier --check ($count file(s))"
    if ! node_modules/.bin/prettier --check "$@"; then
      problem "prettier reported formatting issues — run: npx prettier --write <files>"
    fi
  else
    note "prettier is not installed (run 'npm install' at the repo root) — skipping formatting checks."
  fi
}

# --- eslint (per app, so the app-level config is picked up) -----------------
run_app_eslint() {
  local app="$1"
  shift
  local count="$#"
  if [ "$count" -eq 0 ]; then
    return 0
  fi
  if [ ! -x "$app/node_modules/.bin/eslint" ]; then
    note "eslint is not installed in $app (run 'npm --prefix $app install') — skipping."
    return 0
  fi
  note "eslint ($count file(s) in $app)"
  local rel=()
  local f
  for f in "$@"; do
    rel+=("${f#"$app"/}")
  done
  if ! (cd "$app" && ./node_modules/.bin/eslint "${rel[@]}"); then
    problem "eslint reported problems in $app."
  fi
}

if [ "${#ts_files[@]}" -gt 0 ] || [ "${#js_files[@]}" -gt 0 ]; then
  run_prettier ${ts_files[@]+"${ts_files[@]}"} ${js_files[@]+"${js_files[@]}"}
fi

backend_js=()
frontend_js=()
for path in ${ts_files[@]+"${ts_files[@]}"} ${js_files[@]+"${js_files[@]}"}; do
  case "$path" in
    apps/backend/*) backend_js+=("$path") ;;
    apps/frontend/*) frontend_js+=("$path") ;;
  esac
done

if [ "${#backend_js[@]}" -gt 0 ]; then
  run_app_eslint apps/backend "${backend_js[@]}"
fi
if [ "${#frontend_js[@]}" -gt 0 ]; then
  run_app_eslint apps/frontend "${frontend_js[@]}"
fi

# --- rustfmt ----------------------------------------------------------------
if [ "${#rs_files[@]}" -gt 0 ]; then
  if command -v rustfmt >/dev/null 2>&1; then
    note "rustfmt --check (${#rs_files[@]} file(s))"
    if ! rustfmt --edition 2021 --check "${rs_files[@]}"; then
      problem "rustfmt reported formatting issues — run: rustfmt --edition 2021 <files>"
    fi
  else
    note "rustfmt not found (run: rustup component add rustfmt) — skipping Rust checks."
  fi
fi

# --- shellcheck -------------------------------------------------------------
if [ "${#sh_files[@]}" -gt 0 ]; then
  if command -v shellcheck >/dev/null 2>&1; then
    note "shellcheck (${#sh_files[@]} file(s))"
    if ! shellcheck "${sh_files[@]}"; then
      problem "shellcheck reported issues."
    fi
  else
    note "shellcheck not found (see README) — skipping shell checks."
  fi
fi

if [ "$failed" -ne 0 ]; then
  problem "checks failed. Fix the issues above, or bypass with: git commit --no-verify"
  exit 1
fi

note "all checks passed."
