#!/usr/bin/env bash
# Start PickFix in 3 tmux panes.
# Usage: pnpm dev:tmux [next|nuxt]
set -euo pipefail

SESSION="pickfix"
TARGET="${1:-next}"

if [[ "$TARGET" != "next" && "$TARGET" != "nuxt" ]]; then
  echo "Usage: pnpm dev:tmux [next|nuxt]" >&2
  exit 1
fi

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

cd "$(dirname "$0")/.."

# Top pane: target demo
tmux new-session -d -s "$SESSION" -n pickfix
tmux send-keys -t "$SESSION" "pnpm dev:${TARGET}-demo" Enter

# Split right: proxy
tmux split-window -h -t "$SESSION"
tmux send-keys -t "$SESSION" 'sleep 4 && pnpm dev:proxy' Enter

# Bottom left: web
tmux split-window -v -t "$SESSION:0.0"
tmux send-keys -t "$SESSION" 'sleep 6 && pnpm dev:web' Enter

tmux select-layout -t "$SESSION" even-vertical

echo "PickFix started with ${TARGET} demo in tmux session: $SESSION"
echo "Attach with: tmux attach -t $SESSION"
