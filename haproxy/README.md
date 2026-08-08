# HAProxy (xbox2)

Config for HAProxy on **xbox2** (192.168.222.202). Backend: local webserver (127.0.0.1:40000) plus optional xbox3–xbox7 on port 40000.

## Deploy

Copy config and Cloudflare IP lists to the server, then reload:

```bash
sudo cp haproxy.cfg /etc/haproxy/haproxy.cfg
sudo cp cloudflare-ips-v4.txt cloudflare-ips-v6.txt /etc/haproxy/
sudo haproxy -c -f /etc/haproxy/haproxy.cfg   # config check
sudo systemctl reload haproxy
```

**Cloudflare-only:** The config restricts HTTP/HTTPS to Cloudflare IPs. To refresh lists:

```bash
curl -s https://www.cloudflare.com/ips-v4 -o /etc/haproxy/cloudflare-ips-v4.txt
curl -s https://www.cloudflare.com/ips-v6 -o /etc/haproxy/cloudflare-ips-v6.txt
sudo systemctl reload haproxy
```

See `cloudflare-allowlist.md` for UFW and other options.

## Socket

Config uses:

- `stats socket /run/haproxy/admin.sock`

On some systems the path is `/var/run/haproxy/admin.sock` (symlink to `/run`). Use the path that exists on xbox2.

## Show backend status (hashow)

Source this on xbox2 (or add to `~/.bashrc`) to show backend server state. Socket path must match the server (e.g. `/run/haproxy/admin.sock` or `/var/run/haproxy/admin.sock`):

```bash
hashow() {
    echo "show servers state" | sudo socat stdio /run/haproxy/admin.sock | awk 'NR>2 { status = ($6 == 2) ? "UP" : "DOWN"; print "Server: " $4 " (" $5 "), Status: " status }'
}
```

If your socket is under `/var/run`, use:

```bash
hashow() {
    echo "show servers state" | sudo socat stdio /var/run/haproxy/admin.sock | awk 'NR>2 { status = ($6 == 2) ? "UP" : "DOWN"; print "Server: " $4 " (" $5 "), Status: " status }'
}
```

`$6 == 2` is the HAProxy server state (2 = running/UP). Run `hashow` a few seconds after reload so health checks have run; powered-off backends will show DOWN.
