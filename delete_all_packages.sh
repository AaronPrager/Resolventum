#!/bin/bash

# Script to delete all packages
# This will delete ALL packages for the authenticated user

echo "WARNING: This will delete ALL packages for your account!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Get JWT token (you'll need to replace this with your actual token)
# You can get it from browser dev tools -> Application -> Local Storage -> token
TOKEN="YOUR_JWT_TOKEN_HERE"

# API endpoint (adjust the URL if needed)
API_URL="http://localhost:5002/api/packages/all"

# Delete all packages
response=$(curl -X DELETE "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo ""
echo "Response:"
echo "$body"
echo ""
echo "HTTP Status: $http_code"

if [ "$http_code" -eq 200 ]; then
  echo "✓ All packages deleted successfully"
else
  echo "✗ Error deleting packages"
fi
