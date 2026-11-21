#!/bin/sh
# Runs inside a short-lived helper container started by the sidecar (app.py,
# /update/*): same image as the sidecar, the host's repo path bind-mounted
# read-write at the SAME path, the docker socket, and the repo owner's uid so
# nothing in .git ends up root-owned. Two modes:
#
#   update.sh fetch              git fetch origin <current branch>; nothing else
#   update.sh apply <commit>     fast-forward the checkout to <commit> (which
#                                must be origin/<branch> at that moment), then
#                                docker compose build + up -d the configured
#                                services. Never re-renders nginx, never
#                                touches .env: images only.
#
# Prints STEP i/N lines so the Command Center can show progress, DONE on
# success, and a line starting with ✗ on failure.
set -eu
mode="${1:?fetch|apply}"
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0='*' GIT_TERMINAL_PROMPT=0
profile="${COMPOSE_PROFILE:-prod}"
services="${UPDATE_SERVICES:-backend-prod frontend-prod control-plane}"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "HEAD" ]; then echo "✗ detached HEAD; check out a branch on the host first"; exit 2; fi

echo "STEP 1/4: fetch origin/$branch"
git fetch --quiet origin "$branch"
remote="$(git rev-parse "origin/$branch")"
echo "origin/$branch is at $remote"

if [ "$mode" = "fetch" ]; then echo "DONE: fetched"; exit 0; fi
[ "$mode" = "apply" ] || { echo "✗ unknown mode $mode"; exit 2; }
target="${2:?commit}"
if [ "$remote" != "$target" ]; then
  echo "✗ origin/$branch moved to $remote since the preview (expected $target); preview again and re-apply"
  exit 3
fi

echo "STEP 2/4: fast-forward $(git rev-parse --short HEAD) → $(git rev-parse --short "$target")"
git merge --ff-only --quiet "$target"

echo "STEP 3/4: build images: $services (profile $profile)"
# shellcheck disable=SC2086
docker compose --profile "$profile" build $services

echo "STEP 4/4: recreate containers: $services"
# shellcheck disable=SC2086
docker compose --profile "$profile" up -d --no-deps $services

echo "DONE: now at $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
