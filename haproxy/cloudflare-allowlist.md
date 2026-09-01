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

### Symptoms (production)

| Phone network | What you see |
|---------------|--------------|
| **Cellular only (WiFi off)** | Phone: **HTTP 403** / “Upload blocked… Cloudflare or the firewall…” — Cloudflare returned an HTML block page; **POST never reached Node**. |
| **WiFi on** | Phone hangs on **“Uploading photo…”**; desktop QR modal often shows **504**. Upload reached (or partially reached) the edge/proxy but timed out — see HAProxy timeouts below. |

Cellular browsers are often flagged by **Bot Fight Mode**, **OWASP**, or **rate limits** on `POST /api/mobilePhotoUpload/photo` even when `GET` validate/status works. Desktop status polls can still show `RESPONSE OK` in PM2 while the phone POST is blocked.

### Fix in Cloudflare dashboard (zone `onlinemall.website`) — required for cellular 403

1. **Security → Events** — find the block; note the **Ray ID** and **rule** (often Bot Fight / Managed WAF).
2. **Security → WAF → Custom rules** — create a **Skip** rule (place it **above** blocking rules):
   - **Name:** `Allow mobile photo upload`
   - **Expression:**
     ```
     (http.request.uri.path contains "/mobilePhotoUpload") or (http.request.uri.path contains "/api/mobilePhotoUpload")
     ```
   - **Action:** **Skip** → enable skip for **All remaining custom rules**, **Super Bot Fight Mode** / **Bot Fight Mode**, and **Rate limiting** (as available on your plan).
3. Optional: **Security → Bots** — confirm Bot Fight is not still challenging that path; re-check Events after a cellular retry.
4. Scan a **fresh** QR from the desktop after the rule is **Deployed**.

Also check **RULE2 / ASN block** (`CLOUDFLARE_ASN_*` sync): if a carrier ASN is on the VPN list, cellular will 403 for the whole site—not only upload. Events will show the ASN rule.

### HAProxy timeouts (WiFi hang / 504)

Repo `haproxy/haproxy.cfg` uses longer timeouts for phone multipart POSTs (`timeout http-request 120s`, `client`/`server` `300s`). After pulling that change on the HAProxy host:

```bash
sudo cp ~/code/main/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg   # or your install path
sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl reload haproxy
```

A **10s `timeout http-request`** aborts slow phone bodies mid-upload → endless spinner + gateway **504**.

### App-side (repo)

QR links use path tokens `https://onlinemall.website/mobilePhotoUpload/u/{hex}` (not `?token=`) and lowercase hostname to reduce false positives. Redeploy FE + BE and scan a **fresh** QR after deploy.

The phone page (`fe/src/views/pages/MobilePhotoUploadPage.jsx`) no longer does a native HTML form POST. It now:

| Behavior | Why it matters |
|---|---|
| Re-encodes the photo to **≤ 2 MB JPEG** in the browser before POST | A 5–15 MB camera file is what stalls on cellular and trips size-based edge rules |
| Uploads with **XHR** (progress % + `180s` timeout) | A blocked or stalled POST now shows an error instead of spinning “Uploading photo…” forever |
| Retries once as **base64 JSON** when the multipart POST returns **403** | Many WAF managed rules inspect multipart uploads but pass `application/json`, so this can succeed before the Cloudflare skip rule is in place |

The JSON retry is a fallback, not a substitute — still add the skip rule so the (smaller, faster) multipart path works.

### Verify

- **Cloudflare Events:** after a cellular upload attempt, either no block, or the skip rule matched.
- **PM2:** `[mobilePhotoUpload]` lines for the phone POST (if missing on cellular 403, CF blocked before Ubuntu).
- **Origin (LAN):** `curl -I https://onlinemall.website/mobilePhotoUpload` → `200`. If only phones fail, it is Cloudflare—not Ubuntu/HAProxy.
