#!/usr/bin/env bash
# Open a pull request that adds the CLA caller workflow to one Orbyn repository.
#
# Usage: scripts/enable-cla.sh <repo> [--ref <commit>] [--yes]
#   <repo>   owner/name, or just a name (owner defaults to orbyn-dev)
#   --ref    commit of orbyn-dev/.github to call (default: its current main)
#   --yes    do not ask before opening the pull request
#
# It prints what it will do first. It only creates a branch, one file and a pull request in
# the target repository. It does not touch branch protection, required checks or secrets.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template="$here/../examples/cla-caller.yml"
file=".github/workflows/cla.yml"
branch="chore/cla-check"
yes=0
ref=""
repo=""

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref="${2:?--ref needs a commit}"; shift 2 ;;
    --yes) yes=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) repo="$1"; shift ;;
  esac
done
[ -n "$repo" ] || { echo "Usage: $0 <repo> [--ref <commit>] [--yes]" >&2; exit 2; }
case "$repo" in */*) ;; *) repo="orbyn-dev/$repo" ;; esac
command -v gh >/dev/null || { echo "The gh CLI is required." >&2; exit 1; }
[ -f "$template" ] || { echo "Missing $template" >&2; exit 1; }

case "$repo" in
  orbyn-dev/orbyn-fullstack-skills)
    echo "orbyn-fullstack-skills stays MIT with a DCO sign-off and is not covered by the CLA." >&2
    exit 1 ;;
esac

[ -n "$ref" ] || ref="$(gh api repos/orbyn-dev/.github/commits/main --jq .sha)"
case "$ref" in *[!0-9a-f]*|"") echo "Not a commit sha: $ref" >&2; exit 1 ;; esac
default_branch="$(gh api "repos/$repo" --jq .default_branch)"
base_sha="$(gh api "repos/$repo/git/ref/heads/$default_branch" --jq .object.sha)"
if gh api "repos/$repo/contents/$file?ref=$default_branch" >/dev/null 2>&1; then
  echo "$repo already has $file on $default_branch. Nothing to do." >&2
  exit 1
fi

content="$(sed "s/SHA_OF_ORBYN_DEV_GITHUB_MAIN/$ref/" "$template")"

cat <<PLAN
This will, in $repo:
  1. create the branch $branch from $default_branch ($base_sha)
  2. add $file calling orbyn-dev/.github/.github/workflows/cla.yml@$ref
  3. open a pull request to $default_branch
It will not change branch protection, required checks or secrets. Afterwards, to enforce it:
  - the org secret CLA_SIGNATURES_TOKEN must exist, and
  - require the status check named CLA on $default_branch (done by hand).
PLAN

if [ "$yes" -ne 1 ]; then
  read -r -p "Continue? [y/N] " answer
  case "$answer" in y|Y|yes) ;; *) echo "Cancelled."; exit 1 ;; esac
fi

gh api "repos/$repo/git/refs" -f ref="refs/heads/$branch" -f sha="$base_sha" >/dev/null
gh api -X PUT "repos/$repo/contents/$file" \
  -f message="chore: check the Orbyn contributor agreement on pull requests" \
  -f content="$(printf '%s\n' "$content" | base64 | tr -d '\n')" \
  -f branch="$branch" >/dev/null
gh pr create --repo "$repo" --base "$default_branch" --head "$branch" \
  --title "chore: check the Orbyn contributor agreement on pull requests" \
  --body "Adds the shared CLA check (\`CLA\` status). Authors comment \`/orbynAgree\` once, which covers every Orbyn repository. Organisation members and bots need nothing. Merge, then require the \`CLA\` status check on \`$default_branch\`. See https://github.com/orbyn-dev/.github/blob/main/README.md."
