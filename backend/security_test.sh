#!/bin/bash

# FEDERAL COMPLIANCE: Security Testing Script

echo "🔒 FEDERAL-LEVEL SECURITY TEST SUITE"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="https://superchargd.preview.emergentagent.com"
FAILED=0

# Test 1: CORS Protection
echo "Test 1: CORS Protection"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: https://malicious-site.com" "$API_URL/api/health")
if [ "$RESPONSE" -eq "200" ]; then
    echo -e "${RED}✗ FAILED: CORS allows unauthorized origin${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✓ PASSED: CORS blocking unauthorized origins${NC}"
fi
echo ""

# Test 2: Rate Limiting
echo "Test 2: Rate Limiting"
echo "Sending 105 requests in rapid succession..."
for i in {1..105}; do
    curl -s -o /dev/null "$API_URL/api/health" &
done
wait
sleep 2
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
if [ "$RESPONSE" -eq "429" ]; then
    echo -e "${GREEN}✓ PASSED: Rate limiting active${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Rate limit not triggered (may need adjustment)${NC}"
fi
echo ""

# Test 3: Security Headers
echo "Test 3: Security Headers"
HEADERS=$(curl -s -I "$API_URL/api/health")

if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✓ HSTS header present${NC}"
else
    echo -e "${RED}✗ HSTS header missing${NC}"
    FAILED=$((FAILED + 1))
fi

if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✓ X-Frame-Options present${NC}"
else
    echo -e "${RED}✗ X-Frame-Options missing${NC}"
    FAILED=$((FAILED + 1))
fi

if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    echo -e "${GREEN}✓ CSP header present${NC}"
else
    echo -e "${RED}✗ CSP header missing${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 4: Authentication Required
echo "Test 4: Authentication on Protected Endpoints"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/customers")
if [ "$RESPONSE" -eq "401" ]; then
    echo -e "${GREEN}✓ PASSED: Authentication required${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Endpoint may be unprotected (status: $RESPONSE)${NC}"
fi
echo ""

# Test 5: SQL Injection Protection
echo "Test 5: NoSQL Injection Protection"
RESPONSE=$(curl -s -X POST "$API_URL/api/customers" \
  -H "Content-Type: application/json" \
  -d '{"name": {"$ne": null}}')
if echo "$RESPONSE" | grep -q "error\|invalid"; then
    echo -e "${GREEN}✓ PASSED: Injection attempt blocked${NC}"
else
    echo -e "${RED}✗ FAILED: May be vulnerable to injection${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 6: Input Validation
echo "Test 6: Input Validation"
RESPONSE=$(curl -s -X POST "$API_URL/api/tower-talk" \
  -H "Content-Type: application/json" \
  -d '{"context": "'$(python3 -c 'print("A" * 100000)')'"}')
if echo "$RESPONSE" | grep -q "error\|too large\|invalid"; then
    echo -e "${GREEN}✓ PASSED: Large input rejected${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: May accept oversized input${NC}"
fi
echo ""

# Summary
echo "===================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CRITICAL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED TESTS FAILED${NC}"
    exit 1
fi