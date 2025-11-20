echo "🚀 Launching backend and frontend dev servers in new Terminal windows..."

# Backend
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd $(pwd)/backend && npm install --loglevel=error && npm run dev"
end tell
EOF

# Frontend
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd $(pwd)/frontend && npm install --loglevel=error && npm run dev"
end tell
EOF

echo "✔️ Dev servers launching."
echo "You may close this window, dev environment is running in separate terminals."

open http://localhost:5173
open http://localhost:4000
