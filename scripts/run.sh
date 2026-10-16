#!/usr/bin/env bash
set -euo pipefail

check_only=false
case "${1:-}" in
  "") ;;
  --check-only) check_only=true ;;
  *) printf 'Usage: %s [--check-only]\n' "$0" >&2; exit 2 ;;
esac
if (( $# > 1 )); then
  printf 'Usage: %s [--check-only]\n' "$0" >&2
  exit 2
fi

for tool in vp cargo rustc; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf "Required tool '%s' was not found. Ensure Vite+ (vp) and Rust (cargo, rustc) are on PATH.\n" "$tool" >&2
    exit 1
  fi
done

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"

export CARGO_TARGET_DIR="$project_root/src-tauri/target"
cargo_manifest="src-tauri/Cargo.toml"

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  printf '  $ %s\n' "$*"
  "$@"
}

# 0. Install dependencies
run_step 'Install dependencies (TypeScript)' vp install --frozen-lockfile

# 1. Format (TypeScript + Rust)
run_step 'Format TypeScript codebase' vp fmt .
run_step 'Format Rust codebase' cargo fmt --manifest-path "$cargo_manifest"

# 2. Lint & Static Checks (TypeScript + Rust)
run_step 'Lint and typecheck TypeScript codebase' vp check --no-fmt
run_step 'Lint Rust codebase (Clippy)' cargo clippy --locked --manifest-path "$cargo_manifest" --all-targets -- -D warnings

# 3. Build (TypeScript + Rust/Tauri)
run_step 'Build TypeScript frontend' vp build
run_step 'Build Rust/Tauri backend' cargo build --locked --manifest-path "$cargo_manifest"

# 4. Test (TypeScript + Rust)
run_step 'Run TypeScript tests' vp test
run_step 'Run Rust tests' cargo test --locked --manifest-path "$cargo_manifest"

# 5. Launch Tauri desktop app
if [[ "$check_only" == false ]]; then
  printf '\n==> Start Tauri desktop application (Ctrl+C to stop)\n'
  printf '  $ vp exec tauri dev\n'
  exec vp exec tauri dev
fi
