#!/bin/bash
# ── newsagg dev launcher ─────────────────────────────────────────────────────

PROJECT="/Users/muhammadarsalanamjad/Downloads/newsagg2026"
BACKEND="http://localhost:8000"
FRONTEND="http://localhost:3000"

# ── 1. Kill anything already on the ports ────────────────────────────────────
echo "Clearing ports 3000 and 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 0.5

# ── 2. Open backend in a new Terminal window ─────────────────────────────────
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$PROJECT/backend' && uvicorn app.main:app --reload"
    set custom title of front window to "newsagg | backend"
end tell
EOF

sleep 0.5

# ── 3. Open frontend in a second Terminal window ─────────────────────────────
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$PROJECT/frontend' && npm run dev"
    set custom title of front window to "newsagg | frontend"
end tell
EOF

# ── 4. Wait for backend /health ──────────────────────────────────────────────
echo "Waiting for backend..."
until curl -sf "$BACKEND/health" > /dev/null 2>&1; do
    sleep 1
done
echo "Backend ready."

# ── 5. Wait for frontend ─────────────────────────────────────────────────────
echo "Waiting for frontend..."
until curl -sf "$FRONTEND" > /dev/null 2>&1; do
    sleep 1
done
echo "Frontend ready."

# ── 6. Open Chrome ───────────────────────────────────────────────────────────
open -a "Google Chrome" "$FRONTEND"

# ── 7. Trigger scrape ────────────────────────────────────────────────────────
sleep 1
echo "Triggering scrape..."
RESULT=$(curl -s -X POST "$BACKEND/api/scrape")
echo "Scrape complete: $RESULT"
echo ""
echo "All done. You can close this window."
