# Nginx + HTTPS Configuration

Production Nginx reverse proxy with TLS termination for CodeMaster.

## Setup

### 1. Install Nginx + Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2. Get SSL Certificate

```bash
certbot certonly --webroot -w /var/www/certbot -d your-domain.com
```

### 3. Deploy Config

```bash
# Replace YOUR_DOMAIN in the config
sed -i 's/YOUR_DOMAIN/your-domain.com/g' infra/nginx/codemaster.conf

# Copy and enable
cp infra/nginx/codemaster.conf /etc/nginx/sites-available/codemaster
ln -sf /etc/nginx/sites-available/codemaster /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

### 4. Auto-renew

```bash
# Certbot auto-renewal (usually set up automatically)
systemctl enable certbot.timer
```

## Security features

- HTTP -> HTTPS forced redirect
- TLS 1.2+ only, strong cipher suites
- HSTS preload ready
- OCSP stapling
- Security headers (X-Frame-Options, CSP, etc.)
- Blocks access to dotfiles, .env, .git, .sql, .log
- Request size limits
- Proxy header forwarding (X-Real-IP, X-Forwarded-For)
