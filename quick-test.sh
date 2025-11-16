#!/bin/bash
# Quick test helper - creates assessment and opens browser

set -e

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"

echo "📝 Creating test assessment..."

RESPONSE=$(curl -s -X POST "$API_URL/dev/test-assessment" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "finance-ap"}')

# Extract assessmentId and testUrl using grep/sed
ASSESSMENT_ID=$(echo "$RESPONSE" | grep -o '"assessmentId":"[^"]*' | sed 's/"assessmentId":"//')
TEST_URL=$(echo "$RESPONSE" | grep -o '"testUrl":"[^"]*' | sed 's/"testUrl":"//')

if [ -z "$ASSESSMENT_ID" ]; then
  echo "❌ Failed to create test assessment"
  echo "Response: $RESPONSE"
  echo ""
  echo "Make sure:"
  echo "  1. API server is running (cd apps/api && pnpm dev)"
  echo "  2. Database is accessible"
  exit 1
fi

echo "✅ Test assessment created!"
echo "   Assessment ID: $ASSESSMENT_ID"
echo "   Test URL: $TEST_URL"
echo ""
echo "🌐 Opening browser..."

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$TEST_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$TEST_URL" 2>/dev/null || echo "Please open: $TEST_URL"
else
  echo "Please open: $TEST_URL"
fi










