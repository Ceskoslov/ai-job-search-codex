#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: tools/run_tex.sh <engine> [arguments...]" >&2
  exit 2
fi

tex_engine="$1"
shift

if [[ ! "$tex_engine" =~ ^[A-Za-z0-9._+-]+$ ]]; then
  echo "Invalid TeX engine name: $tex_engine" >&2
  exit 2
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"

# Prefer an explicit override, then the persistent repository-local TeX Live.
# Use absolute executable paths: TeX Live derives its installation root from
# argv[0], and a relative .texlive/... path can make kpathsea look under /.
if [[ -n "${AI_JOB_SEARCH_TEX_BIN:-}" ]]; then
  candidate="${AI_JOB_SEARCH_TEX_BIN%/}/$tex_engine"
  if [[ -x "$candidate" ]]; then
    exec "$candidate" "$@"
  fi
  echo "AI_JOB_SEARCH_TEX_BIN does not contain executable '$tex_engine': ${AI_JOB_SEARCH_TEX_BIN}" >&2
  exit 1
fi

shopt -s nullglob
for tex_bin_dir in "$repo_root"/.texlive/bin/*; do
  candidate="$tex_bin_dir/$tex_engine"
  if [[ -x "$candidate" ]]; then
    exec "$candidate" "$@"
  fi
done

if candidate="$(command -v -- "$tex_engine" 2>/dev/null)" && [[ -n "$candidate" ]]; then
  exec "$candidate" "$@"
fi

echo "TeX engine '$tex_engine' was not found." >&2
echo "Install TeX Live in '$repo_root/.texlive' or put the engine on PATH; see SETUP.md." >&2
exit 127
