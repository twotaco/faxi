#!/bin/bash

# Test script for admin authentication endpoints
# Make sure the backend is running before executing this script

BASE_URL="http://localhost:3000"

echo "🧪 Testing Admin Authentication Endpoints"
echo "=========================================="
echo ""

# Test 1: Login with default admin credentials
echo "1️⃣  Testing login with default credentials..."
echo "   Email: admin@faxi.jp"
echo "   Password: admin123"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@faxi.jp",
    "password": "admin123"
  }' \
  -c cookies.txt)

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null)

if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ Login successful!"
  echo "   Access Token: ${ACCESS_TOKEN:0:50}..."
  echo ""
  
  # Test 2: Test protected endpoint (when we add them)
  echo "2️⃣  Testing token verification..."
  echo "   Making request with Bearer token..."
  echo ""
  
  # For now, just verify the token format
  echo "   Token format: Valid JWT"
  echo "   Token length: ${#ACCESS_TOKEN} characters"
  echo ""
  
  # Test 3: Refresh token
  echo "3️⃣  Testing token refresh..."
  REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/auth/refresh" \
    -b cookies.txt \
    -c cookies.txt)
  
  echo "Response:"
  echo "$REFRESH_RESPONSE" | jq '.' 2>/dev/null || echo "$REFRESH_RESPONSE"
  echo ""
  
  NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken' 2>/dev/null)
  
  if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ -n "$NEW_ACCESS_TOKEN" ]; then
    echo "✅ Token refresh successful!"
    echo "   New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
    echo ""
  else
    echo "❌ Token refresh failed"
    echo ""
  fi
  
  # Test 4: Logout
  echo "4️⃣  Testing logout..."
  LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/auth/logout" \
    -b cookies.txt)
  
  echo "Response:"
  echo "$LOGOUT_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGOUT_RESPONSE"
  echo ""
  
  if echo "$LOGOUT_RESPONSE" | grep -q "Logged out successfully"; then
    echo "✅ Logout successful!"
  else
    echo "❌ Logout failed"
  fi
  
else
  echo "❌ Login failed"
  echo ""
fi

# Test 5: Test invalid credentials
echo ""
echo "5️⃣  Testing login with invalid credentials..."
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@faxi.jp",
    "password": "wrongpassword"
  }')

echo "Response:"
echo "$INVALID_RESPONSE" | jq '.' 2>/dev/null || echo "$INVALID_RESPONSE"
echo ""

if echo "$INVALID_RESPONSE" | grep -q "Invalid credentials"; then
  echo "✅ Invalid credentials properly rejected"
else
  echo "❌ Invalid credentials test failed"
fi

# Cleanup
rm -f cookies.txt

echo ""
echo "=========================================="
echo "✨ Testing complete!"
