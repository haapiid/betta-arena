#!/bin/sh
# One-time setup of a fresh Ubuntu VPS for Betta Arena: Node 22, nginx, pm2, the site and the engine.
# Run it from inside the cloned repo:  sudo sh scripts/install-server.sh yourdomain.com you@example.com
# Afterwards: fill engine/.env and .env (see docs/DEPLOY.md), then  npm run build  and
#   pm2 restart betta-engine --update-env
set -e
DOMAIN="${1:-}"
EMAIL="${2:-}"
if [ -z "$DOMAIN" ]; then echo "usage: sudo sh scripts/install-server.sh yourdomain.com [email-for-https]" >&2; exit 1; fi
APP="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="${SUDO_USER:-$(whoami)}"

echo "== packages"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
fi
apt-get install -y nodejs nginx certbot python3-certbot-nginx
command -v pm2 >/dev/null 2>&1 || npm i -g pm2

echo "== app"
cd "$APP"
sudo -u "$USER_NAME" npm ci
sudo -u "$USER_NAME" sh -c "cd engine && npm ci"
[ -f engine/.env ] || sudo -u "$USER_NAME" cp engine/.env.example engine/.env
[ -f .env ] || sudo -u "$USER_NAME" sh -c "cp .env.example .env && echo SITE_URL=https://$DOMAIN >> .env"
sudo -u "$USER_NAME" npm run build

echo "== engine (pm2)"
sudo -u "$USER_NAME" sh -c "cd engine && pm2 start 'npm start' --name betta-engine || pm2 restart betta-engine"
sudo -u "$USER_NAME" pm2 save
env PATH="$PATH" pm2 startup systemd -u "$USER_NAME" --hp "$(eval echo ~"$USER_NAME")" >/dev/null || true

echo "== nginx"
cat > /etc/nginx/sites-available/betta-arena <<NGINX
server {
  listen 80;
  server_name $DOMAIN;
  root $APP/dist;
  index index.html;

  add_header X-Frame-Options DENY always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;

  location /api/stream {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
  location /api/ { proxy_pass http://127.0.0.1:5050; proxy_set_header X-Forwarded-For \$remote_addr; }
  # shared fight links: the engine serves a page whose preview on X is the fight's card
  location /fight/ { proxy_pass http://127.0.0.1:5050; proxy_set_header X-Forwarded-For \$remote_addr; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location /community { try_files /index.html =404; }
  location / { try_files \$uri /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/betta-arena /etc/nginx/sites-enabled/betta-arena
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if [ -n "$EMAIL" ]; then
  echo "== https"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

echo
echo "Done. Next: edit $APP/engine/.env and $APP/.env, then"
echo "  cd $APP && npm run build && pm2 restart betta-engine --update-env"
echo "  sh scripts/postlaunch-check.sh"
