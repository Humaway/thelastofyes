#!/usr/bin/env bash
# Private working copies for parallel agents (see ARCHITECTURE.md "Agent workflow").
#   tools/sandbox.sh NAME                         create/overwrite /tmp/tloy-NAME from the main tree
#   tools/sandbox.sh NAME refresh OWN_FILE...     pull every src/ file from the main tree EXCEPT your own files
#   tools/sandbox.sh NAME deliver OWN_FILE...     copy your own files (paths relative to repo root) back to the main tree
set -euo pipefail
MAIN=/home/user/thelastofyes; SB=/tmp/tloy-$1; CMD=${2:-create}; shift; shift || true
case $CMD in
  create)
    rm -rf "$SB"; mkdir -p "$SB"
    (cd "$MAIN" && tar cf - --exclude=./node_modules --exclude=./out --exclude=./.git .) | (cd "$SB" && tar xf -)
    ln -sfn "$MAIN/node_modules" "$SB/node_modules"; echo "sandbox: $SB" ;;
  refresh)
    for f in "$MAIN"/src/* "$MAIN"/tools/* "$MAIN"/ARCHITECTURE.md; do
      rel=${f#$MAIN/}; own=0; for o in "$@"; do [ "$o" = "$rel" ] && own=1; done
      [ $own = 1 ] || cp "$f" "$SB/$rel"
    done; echo "refreshed $SB (kept: $*)" ;;
  deliver)
    for o in "$@"; do cp "$SB/$o" "$MAIN/$o"; echo "delivered $o"; done ;;
esac
