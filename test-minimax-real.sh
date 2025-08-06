#!/bin/bash

echo "🧪 Testing MiniMax API with real audio file..."

API_KEY="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJhYmVsIiwiVXNlck5hbWUiOiJhYmVsIiwiQWNjb3VudCI6IiIsIlN1YmplY3RJRCI6IjE5MzI2NjQ1ODc0MDQ5NzcwNzIiLCJQaG9uZSI6IjE3Njg4OTMyMjExIiwiR3JvdXBJRCI6IjE5MzI2NjQ1ODczOTY1ODg0NjQiLCJQYWdlTmFtZSI6IiIsIk1haWwiOiIiLCJDcmVhdGVUaW1lIjoiMjAyNS0wNy0yMyAwMDoyMzoxMyIsIlRva2VuVHlwZSI6MSwiaXNzIjoibWluaW1heCJ9.eFcHsddnnF4BgABinLDsGd2_n2avVi9hl4ZgmXVChjWMhPPNv4b-BkLoZVJ9tLwpvoyjzPrz9kIZXc3ZUPA1XBywEX0Y_58XkgXPWbtj_xWmaAkILgszVh0NxrCM6Jq1xWHNqVUSCxBoMtDZnC-1mHaddDz0DBl6NiSbpyvK9ym0kDEe2MFByFO-MKW9CXDyLIVi3lvi4ErZpE1CQxp7r96i3vR_CCoFICwRmld5Kuefgx7jdQrrFMo7vk2xbTUB-w_vvVmX9Of5WlKa0v0UP3VuYWWvgaq3W1xY0SEK7IGgNXe34rY_6TXV0FdV9I0NXi8HVC5-PRvFchHzxnVmNw"

if [ ! -f "test-audio.wav" ]; then
  echo "❌ test-audio.wav not found!"
  exit 1
fi

echo "📄 Testing with audio file: test-audio.wav ($(wc -c < test-audio.wav) bytes)"

# Test the main endpoint
echo ""
echo "🔗 Testing https://api.minimaxi.chat/v1/speech_to_text"

response=$(curl -s -w "\nSTATUS_CODE:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@test-audio.wav" \
  -F "model=speech-01" \
  -F "response_format=json" \
  -F "language=auto" \
  "https://api.minimaxi.chat/v1/speech_to_text" 2>&1)

echo "Response:"
echo "$response"

echo ""
echo "🔗 Testing https://api.minimaxi.chat/v1/speech-to-text"

response2=$(curl -s -w "\nSTATUS_CODE:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@test-audio.wav" \
  -F "model=speech-01" \
  -F "response_format=json" \
  -F "language=auto" \
  "https://api.minimaxi.chat/v1/speech-to-text" 2>&1)

echo "Response:"
echo "$response2"

echo ""
echo "✅ Testing completed!"