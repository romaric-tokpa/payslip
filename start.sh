#!/bin/bash
echo "🚀 PaySlip Manager — Démarrage complet"

# 1. Docker
echo "⏳ Docker..."
cd /Users/tokpa/Desktop/PaySlip
docker compose up -d
sleep 3

# 2. Vérifie que les services Docker sont prêts
until curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  echo "  Attente MinIO..."
  sleep 2
done
echo "✅ Docker OK (PostgreSQL, MinIO, Redis)"

# 3. IP LAN
LAN_IP=$(ipconfig getifaddr en0)
echo "📡 IP LAN : $LAN_IP"

# 4. Met à jour S3_PUBLIC_ENDPOINT avec la bonne IP
cd /Users/tokpa/Desktop/PaySlip/backend
sed -i '' "s|S3_PUBLIC_ENDPOINT=.*|S3_PUBLIC_ENDPOINT=http://${LAN_IP}:9000|" .env
echo "✅ S3_PUBLIC_ENDPOINT mis à jour"

# 5. Backend
echo "⏳ Backend..."
npm run start:dev &
BACKEND_PID=$!

until curl -s http://localhost:3000/docs > /dev/null 2>&1; do
  echo "  Attente backend..."
  sleep 3
done
echo "✅ Backend OK — http://localhost:3000/docs"

# 6. Admin
echo "⏳ Admin..."
cd /Users/tokpa/Desktop/PaySlio "✅ Admin lancé — http://localhost:5173"

# 7. Mobile
echo "⏳ Mobile..."
cd /Users/tokpa/Desktop/PaySlip/mobile
REACT_NATIVE_PACKAGER_HOSTNAME=$LAN_IP npx expo start --clear &
echo "✅ Mobile lancé — scanne le QR code"

echo ""
echo "=========================================="
echo "  PaySlip Manager prêt !"
echo "  Backend  : http://localhost:3000/docs"
echo "  Admin    : http://localhost:5173"
echo "  Mobile   : IP $LAN_IP (auto-détecté)"
echo "=========================================="

wait
