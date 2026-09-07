#!/bin/sh
# Simple helper script to check Yuniko API endpoints from a shell.
# Usage: ./scripts/check-api.sh [API_BASE_URL]
# Example: ./scripts/check-api.sh https://yuniko-api.lafatriniainaallane.workers.dev

API_BASE=${1:-https://yuniko-api.lafatriniainaallane.workers.dev}

echo "Checking API health at $API_BASE/api/health"
curl -v --fail "$API_BASE/api/health" || echo "Health check failed"

echo
echo "Checking user endpoint (public) at $API_BASE/api/users/1"
curl -v --fail "$API_BASE/api/users/1" || echo "User endpoint check failed"

# If your API requires auth for /users/1, pass a token via env:
# AUTH_TOKEN=... ./scripts/check-api.sh https://... 
if [ -n "$AUTH_TOKEN" ]; then
  echo
  echo "Checking user endpoint with Authorization header"
  curl -v -H "Authorization: Bearer $AUTH_TOKEN" --fail "$API_BASE/api/users/1" || echo "Auth user endpoint check failed"
fi
