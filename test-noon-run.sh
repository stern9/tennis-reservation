#!/bin/bash

# One-off test script - runs at noon Costa Rica time
# Tests both 10am (expected failure) and 11am (expected success)

echo "🎾 Noon Test Run - Waiting for 12:00 PM Costa Rica Time"
echo "========================================================="
echo ""

# Check environment variables
if [ -z "$TENNIS_USERNAME" ] || [ -z "$TENNIS_PASSWORD" ] || [ -z "$RESEND_API_KEY" ]; then
  echo "❌ ERROR: Environment variables not set!"
  echo "Run: set -a; source .env; set +a"
  exit 1
fi

# Wait until noon Costa Rica time
while true; do
  CURRENT_HOUR=$(TZ='America/Costa_Rica' date +%H)
  CURRENT_MINUTE=$(TZ='America/Costa_Rica' date +%M)
  CURRENT_SECOND=$(TZ='America/Costa_Rica' date +%S)

  if [ "$CURRENT_HOUR" = "12" ] && [ "$CURRENT_MINUTE" = "15" ] && [ "$CURRENT_SECOND" = "00" ]; then
    echo "🕐 12:15 PM reached! Starting tests..."
    break
  fi

  # Show countdown every minute in last 5 minutes
  if [ "$CURRENT_HOUR" = "12" ] && [ "$CURRENT_MINUTE" -ge "10" ] && [ "$CURRENT_SECOND" = "00" ]; then
    MINUTES_LEFT=$((15 - CURRENT_MINUTE))
    echo "⏰ $MINUTES_LEFT minutes until 12:15 PM..."
  fi

  sleep 1
done

echo ""
echo "========================================="
echo "TEST 1: Court 1 at 10:00 AM (expect FAIL)"
echo "========================================="
echo ""

node scripts/reserve.js --test --debug --target-date 2025-10-12 \
  --court1-time "10:00 AM - 11:00 AM" \
  --skip-court2 \
  --keep-screenshots

TEST1_EXIT=$?

echo ""
echo "Test 1 completed with exit code: $TEST1_EXIT"
echo ""
echo "Waiting 5 seconds before Test 2..."
sleep 5

echo ""
echo "========================================="
echo "TEST 2: Court 1 at 11:00 AM (expect SUCCESS)"
echo "========================================="
echo ""

node scripts/reserve.js --test --debug --target-date 2025-10-12 \
  --court1-time "11:00 AM - 12:00 PM" \
  --skip-court2 \
  --keep-screenshots

TEST2_EXIT=$?

echo ""
echo "========================================="
echo "SUMMARY"
echo "========================================="
echo "Test 1 (10am - expect fail): Exit code $TEST1_EXIT"
echo "Test 2 (11am - expect success): Exit code $TEST2_EXIT"
echo ""
echo "Check your email for results!"
echo "Screenshots saved in screenshots/ directory"
echo ""
