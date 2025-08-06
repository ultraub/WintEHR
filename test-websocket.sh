#!/bin/bash

echo "=== WebSocket Connection Test Script ==="
echo ""
echo "1. Testing backend WebSocket endpoint directly..."
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:8000/api/ws

echo ""
echo "2. Checking WebSocket monitoring endpoint..."
curl http://localhost:8000/api/websocket/stats | jq .

echo ""
echo "3. Backend WebSocket logs (last 20 lines)..."
docker-compose logs backend | grep -i websocket | tail -20

echo ""
echo "=== Done ==="