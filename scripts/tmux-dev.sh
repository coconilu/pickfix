#!/usr/bin/env bash
# Start PickFix in 3 tmux panes.
# Usage: pnpm dev:tmux
set -euo pipefail

SESSION="pickfix"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

cd "$(dirname "$0")/.."

# Top pane: demo
tmux new-session -d -s "$SESSION" -n pickfix
tmux send-keys -t "$SESSION" 'pnpm dev:demo' Enter

# Split right: proxy
tmux split-window -h -t "$SESSION"
tmux send-keys -t "$SESSION" 'sleep 4 && pnpm dev:proxy' Enter

# Bottom left: web
tmux split-window -v -t "$SESSION:0.0"
tmux send-keys -t "$SESSION" 'sleep 6 && pnpm dev:web' Enter

tmux select-layout -t "$SESSION" even-vertical

echo "PickFix started in tmux session: $SESSION"
echo "Attach with: tmux attach -t $SESSION"
