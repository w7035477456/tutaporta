# Cloudflare-Only Access (Block Direct IP)

Restrict traffic to Cloudflare IPs only so direct IP access is rejected.

## Option 1: Firewall (UFW) – Recommended

Run on the server that has the public IP (the one receiving traffic).

```bash
# 1. Create allowlist rules
# IPv4 – allow Cloudflare
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow from $ip to any port 80 proto tcp
  sudo ufw allow from $ip to any port 443 proto tcp
done

# IPv6 – allow Cloudflare
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  sudo ufw allow from $ip to any port 80 proto tcp
  sudo ufw allow from $ip to any port 443 proto tcp
done

# 2. Deny direct traffic (HTTP/HTTPS from non-Cloudflare)
sudo ufw deny 80/tcp
sudo ufw deny 443/tcp

# 3. Allow SSH (if needed) – adjust before enabling!
sudo ufw allow 22/tcp

# 4. Enable and reload
sudo ufw enable
sudo ufw reload
sudo ufw status
```

**Warning:** Test SSH first. If you lock yourself out, use console access or VPS recovery.

**Update:** Cloudflare IPs change. Run a cron job weekly:

```bash
# /etc/cron.weekly/cloudflare-ufw-update
#!/bin/bash
ufw delete allow 80/tcp 2>/dev/null
ufw delete allow 443/tcp 2>/dev/null
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  ufw allow from $ip to any port 80 proto tcp
  ufw allow from $ip to any port 443 proto tcp
done
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  ufw allow from $ip to any port 80 proto tcp
  ufw allow from $ip to any port 443 proto tcp
done
ufw reload
```

## Option 2: HAProxy ACL

Use if HAProxy is the first thing receiving public traffic.

1. Copy `cloudflare-ips-v4.txt` and `cloudflare-ips-v6.txt` to the server (e.g. `/etc/haproxy/`).
2. Add to `haproxy.cfg` in the `fe_http` and `fe_https` frontends:

```haproxy
# At top of fe_http (after bind)
frontend fe_http
    bind *:80
    acl from_cloudflare src -f /etc/haproxy/cloudflare-ips-v4.txt
    acl from_cloudflare_v6 src -f /etc/haproxy/cloudflare-ips-v6.txt
    http-request deny if !from_cloudflare !from_cloudflare_v6
    http-request redirect scheme https code 301 unless { ssl_fc }

# Same for fe_https
frontend fe_https
    bind *:443 ssl crt /etc/haproxy/certs/site.pem
    acl from_cloudflare src -f /etc/haproxy/cloudflare-ips-v4.txt
    acl from_cloudflare_v6 src -f /etc/haproxy/cloudflare-ips-v6.txt
    http-request deny if !from_cloudflare !from_cloudflare_v6
    option forwardfor
    ...
```

3. **Update IP files:** Run periodically:

```bash
curl -s https://www.cloudflare.com/ips-v4 -o /etc/haproxy/cloudflare-ips-v4.txt
curl -s https://www.cloudflare.com/ips-v6 -o /etc/haproxy/cloudflare-ips-v6.txt
sudo systemctl reload haproxy
```

## Option 3: Express Middleware (Backup Only)

Use only if firewall/HAProxy is not possible. Add to `be/server_be.js` before routes:

```javascript
// Cloudflare IPs - fetch from https://www.cloudflare.com/ips-v4
const CLOUDFLARE_IPS = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
];
// Use ipaddr.js or similar for CIDR checks; for simplicity: trust X-Forwarded-For
// when behind Cloudflare (CF adds CF-Connecting-IP)
```

Express middleware is weaker than firewall; prefer firewall or HAProxy.

## Summary

| Method | Where | Pros | Cons |
|--------|-------|------|------|
| **UFW** | Firewall | Strong, stops traffic before app | Must manage server |
| **HAProxy** | Proxy | No firewall changes | Need to keep IP lists updated |
| **Express** | App | Quick to add | Traffic reaches app; less reliable |

**Recommendation:** Use UFW on the public-facing server. If that’s HAProxy, use UFW on that host. If HAProxy sits behind a router, use UFW on the router/NAT host or configure firewall rules there.

## Cloudflare WAF: phone QR upload (`/mobilePhotoUpload`)

If a phone scan shows **“Sorry, you have been blocked”** (Cloudflare page with a Ray ID), or the phone page shows **HTTP 403** / **“Server returned HTML instead of JSON”** on upload (while desktop QR status polls show `RESPONSE OK` in PM2 logs), the **POST never reached Node**. Cellular browsers are often flagged by **Bot Fight Mode**, **OWASP**, or **rate limits** on `POST /api/mobilePhotoUpload/photo` even when `GET` validate/status works.

**Fix in Cloudflare dashboard (zone onlinemall.website):**

1. **Security → Events** — find the block; note the **Ray ID** and **rule**.
2. **Security → WAF → Custom rules** — add a skip (or log-only) rule, e.g.:
   - **Expression:** `(http.request.uri.path contains "/mobilePhotoUpload") or (http.request.uri.path contains "/api/mobilePhotoUpload")`
   - **Action:** Skip all remaining custom rules (or skip Bot Fight Mode for that path).
3. Or lower **Security Level** / disable **Bot Fight Mode** for verified mobile upload paths.

**App-side (repo):** QR links use path tokens `https://onlinemall.website/mobilePhotoUpload/u/{hex}` (not `?token=`) and lowercase hostname to reduce false positives. Redeploy FE + BE and scan a **fresh** QR after deploy.

**Verify origin works (bypasses Cloudflare):** from a server on the LAN, `curl -I https://onlinemall.website/mobilePhotoUpload` should return `200` HTML. If only phones fail, it is Cloudflare—not Ubuntu/HAProxy.
