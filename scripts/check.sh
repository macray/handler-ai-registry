#!/usr/bin/env bash
# Reads this registry with a Handler checkout, as Handler reads its official source: run it before
# each push. Fails when the source cannot be read, when an item is in error or missing, or when a
# test of the registry's items fails.
#
#   scripts/check.sh ../handler            # the Handler checkout to read it with
#
# What it reads is this working tree as it would be committed (the files git tracks, and the new
# ones it does not ignore), copied into a scratch repository: Handler reads a source's last commit.
#
# 1. A handlerd on scratch folders, HANDLER_OFFICIAL_SOURCE = that copy: the source and each
#    item's page (GET /v1/sources, GET /v1/sources/official/<kind>/<name>), every folder listed.
# 2. Handler's tests of the registry's own items (HANDLER_TEST_REGISTRY), those whose item this
#    registry holds.
#
# Outside the host (a container, a sandbox): set UV_PROJECT_ENVIRONMENT to a venv of its own, so
# that the checkout's .venv (the host's) is left alone.
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1/packages/control-plane/pyproject.toml" ]]; then
    echo "usage: $0 HANDLER_CHECKOUT" >&2
    exit 2
fi
handler="$(cd "$1" && pwd)"
registry="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/registry-check.XXXXXX")"
daemon=""
cleanup() {
    if [[ -n "$daemon" ]]; then
        kill "$daemon" 2>/dev/null || true
        wait "$daemon" 2>/dev/null || true
    fi
    rm -rf "$scratch"
}
trap cleanup EXIT

if [[ -n "$(git -C "$registry" status --porcelain)" ]]; then
    echo "note: uncommitted changes, read as if committed"
fi
mkdir "$scratch/source"
git -C "$registry" ls-files -z --cached --others --exclude-standard \
    | (cd "$registry" && xargs -0 cp --parents -a -t "$scratch/source")
git -C "$scratch/source" init -q -b main
git -C "$scratch/source" add -A
git -C "$scratch/source" -c user.name=check -c user.email=check@localhost commit -qm check

run() { uv run --quiet --project "$handler" "$@"; }

echo "== handlerd reads the registry"
port="$(run python -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
for d in config state data cache run; do mkdir -p "$scratch/$d"; done
env HANDLER_OFFICIAL_SOURCE="$scratch/source" HANDLER_PORT="$port" \
    XDG_CONFIG_HOME="$scratch/config" XDG_STATE_HOME="$scratch/state" \
    XDG_DATA_HOME="$scratch/data" XDG_CACHE_HOME="$scratch/cache" \
    HANDLER_CONFIG_DIR="$scratch/config/handler-ai" HANDLER_RUNTIME_DIR="$scratch/run" \
    uv run --quiet --project "$handler" handlerd >"$scratch/handlerd.log" 2>&1 &
daemon=$!

status=0
run python - "$port" "$scratch/config/handler-ai" "$registry" <<'EOF' || status=1
import json, sys, time, urllib.error, urllib.request
from pathlib import Path

port, config, registry = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
base = f"http://127.0.0.1:{port}"
for _ in range(120):
    try:
        urllib.request.urlopen(f"{base}/v1/health", timeout=2)
        break
    except OSError:
        time.sleep(0.5)
else:
    sys.exit("handlerd did not start")
token = next(config.glob("token*")).read_text().strip()

def get(path):
    request = urllib.request.Request(base + path, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=120) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

code, sources = get("/v1/sources")
official = next(s for s in sources if s["official"])
failed = False
if official.get("error"):
    print(f"FAIL the source: {official['error']}")
    sys.exit(1)
print(f"source {official.get('name')!r}, {len(official['items'])} items")
roots = {"app": "apps", "agents": "agents", "addon": "tools", "system-package": "system-packages"}
listed = {(i["kind"], i["name"]) for i in official["items"]}
for kind, root in roots.items():
    for folder in sorted(p for p in (registry / root).glob("*") if p.is_dir()):
        if (kind, folder.name) not in listed:
            print(f"FAIL {root}/{folder.name}: not listed")
            failed = True
for i in official["items"]:
    where = f"{roots[i['kind']]}/{i['name']}"
    if i.get("error"):
        print(f"FAIL {where}: {i['error']}")
        failed = True
        continue
    if i["kind"] != "system-package":  # listed only, no page of its own
        page = {"app": "apps", "agents": "agents", "addon": "addons"}[i["kind"]]
        code, detail = get(f"/v1/sources/official/{page}/{i['name']}")
        if code != 200:
            print(f"FAIL {where}: its page, {code} {detail.get('detail', detail)}")
            failed = True
            continue
        if not detail.get("readme"):
            print(f"FAIL {where}: no README.md")
            failed = True
            continue
    notes = ", ".join(n["text"] for n in i.get("notes", []))
    print(f"ok   {where}" + (f" ({notes})" if notes else ""))
sys.exit(1 if failed else 0)
EOF
if [[ $status -ne 0 ]]; then
    echo "(handlerd's log: last lines)"
    tail -n 20 "$scratch/handlerd.log"
fi

echo "== Handler's tests of the registry's items"
# a test of an item this registry does not hold is left out: Planner and shopify stay private
# (a source of their own), their tests are not this registry's
tests=()
for test in $(grep -rl 'requires_registry' "$handler/tests" --include='test_*.py'); do
    items=$(grep -oE '/v1/sources/official/(apps|agents|addons)/[a-z0-9-]+|addons=\("[a-z0-9-]+"' "$test" \
        | sed -E 's#.*/(apps|agents)/#\1/#; s#.*/addons/#tools/#; s#addons=\("#tools/#; s#"##' | sort -u)
    missing=""
    for item in $items; do [[ -d "$registry/$item" ]] || missing="$missing $item"; done
    if [[ -n "$missing" ]]; then
        echo "left out: ${test#"$handler"/} (not here:$missing)"
    else
        tests+=("$test")
    fi
done
if [[ ${#tests[@]} -gt 0 ]]; then
    (cd "$handler" && HANDLER_TEST_REGISTRY="$scratch/source" uv run --quiet pytest -q -rs "${tests[@]}") \
        || status=1
else
    echo "none to run"
fi

if [[ $status -eq 0 ]]; then echo "== ok"; else echo "== FAILED"; fi
exit $status
