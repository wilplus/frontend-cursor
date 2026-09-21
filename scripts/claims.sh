#!/usr/bin/env bash
#
# claims.sh — a claims board so two Claude chats working the same repo do not
# collide (founder, 2026-09-21: "I just don't want duplicates and conflicts").
#
# There is no live channel between two chats: a session that is idle receives
# nothing, and messages are best-effort even when it is not. What both chats
# DO share, always, is this remote. So the board is an orphan branch,
# `claude/claims`, holding one file, claims.json:
#
#   { "señor engineer": { "paths": ["src/lib/api/auth-client.ts", ...],
#                         "note": "401 renewal", "at": "2026-09-21T14:40Z" },
#     "señor 2":        { "paths": ["src/components/willab/DeckChunkModal.tsx"],
#                         "note": "V3 ladder dead-end", "at": "..." } }
#
#   scripts/claims.sh status                         # who holds what
#   scripts/claims.sh claim  "<who>" "<note>" <path>...   # refuses an overlap
#   scripts/claims.sh release "<who>"                # done — free the paths
#
# A claim is a path or a path PREFIX ("src/components/willab/" claims the
# folder). `claim` fetches first, so the answer is the other chat's latest
# push, not this chat's memory of it. Overlap ⇒ exit 1 and the owner named:
# split the work or wait, do not force it. This is a courtesy protocol, not a
# lock — nothing stops a push. It only makes the collision visible BEFORE the
# edit instead of at the merge.
#
# Needs: git, python3. No other dependency.

set -euo pipefail

BRANCH="claude/claims"
FILE="claims.json"
REMOTE="${CLAIMS_REMOTE:-origin}"

root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Bring the board local, creating it empty on first use.
sync_board() {
  if git -C "$root" fetch -q "$REMOTE" "$BRANCH" 2>/dev/null; then
    git -C "$root" --work-tree="$work" checkout -q "$REMOTE/$BRANCH" -- "$FILE" 2>/dev/null \
      || echo '{}' > "$work/$FILE"
    git -C "$root" reset -q -- "$FILE" 2>/dev/null || true
  else
    echo '{}' > "$work/$FILE"
  fi
}

# Commit the board file back to the orphan branch and push it.
publish_board() {
  local msg="$1"
  local blob tree parent commit
  blob="$(git -C "$root" hash-object -w "$work/$FILE")"
  tree="$(printf '100644 blob %s\t%s\n' "$blob" "$FILE" | git -C "$root" mktree)"
  parent="$(git -C "$root" rev-parse -q --verify "$REMOTE/$BRANCH" 2>/dev/null || true)"
  if [ -n "$parent" ]; then
    commit="$(git -C "$root" commit-tree "$tree" -p "$parent" -m "$msg")"
  else
    commit="$(git -C "$root" commit-tree "$tree" -m "$msg")"
  fi
  git -C "$root" -c push.negotiate=false push -q "$REMOTE" "$commit:refs/heads/$BRANCH"
}

cmd="${1:-status}"
shift || true

case "$cmd" in
  status)
    sync_board
    python3 - "$work/$FILE" <<'PY'
import json, sys
board = json.load(open(sys.argv[1]))
if not board:
    print("no claims — the board is empty"); sys.exit()
for who, row in board.items():
    print(f"{who}  ({row.get('at','?')})  — {row.get('note','')}")
    for p in row.get("paths", []):
        print(f"    {p}")
PY
    ;;

  claim)
    who="${1:?who}"; note="${2:?note}"; shift 2
    [ "$#" -gt 0 ] || { echo "claim: give at least one path" >&2; exit 2; }
    sync_board
    python3 - "$work/$FILE" "$who" "$note" "$@" <<'PY'
import json, sys, datetime
path, who, note, *paths = sys.argv[1:]
board = json.load(open(path))
clash = []
for other, row in board.items():
    if other == who: continue
    for theirs in row.get("paths", []):
        for mine in paths:
            if mine.startswith(theirs) or theirs.startswith(mine):
                clash.append((other, theirs, mine))
if clash:
    print("REFUSED — overlap with another chat:", file=sys.stderr)
    for other, theirs, mine in clash:
        print(f"  {other} holds {theirs}  ↔  you asked for {mine}", file=sys.stderr)
    print("Split the work or wait for their release; do not force it.", file=sys.stderr)
    sys.exit(1)
board[who] = {
    "paths": sorted(set(paths)),
    "note": note,
    "at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%MZ"),
}
json.dump(board, open(path, "w"), indent=2, ensure_ascii=False)
print(f"claimed for {who}: {', '.join(sorted(set(paths)))}")
PY
    publish_board "claim: $who — $note"
    ;;

  release)
    who="${1:?who}"
    sync_board
    python3 - "$work/$FILE" "$who" <<'PY'
import json, sys
path, who = sys.argv[1:]
board = json.load(open(path))
if board.pop(who, None) is None:
    print(f"{who} held nothing"); sys.exit()
json.dump(board, open(path, "w"), indent=2, ensure_ascii=False)
print(f"released {who}")
PY
    publish_board "release: $who"
    ;;

  *)
    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
