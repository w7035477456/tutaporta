-- global.blocked_asn_vpn — VPN/Tor ASN numbers blocked via Cloudflare X-Client-ASN.
-- Run against Primary. Safe to re-run.
-- Schema: helloworldjunktest (adjust if needed).
--
-- Mac dev (from repo root):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addGlobalBlockedAsnVpn.sql

ALTER TABLE helloworldjunktest.global
  ADD COLUMN IF NOT EXISTS blocked_asn_vpn integer[] NOT NULL DEFAULT ARRAY[]::integer[];

-- Seed from X4BNet/lists_vpn (input/vpn/ASN.txt) when column is still empty.
UPDATE helloworldjunktest.global
SET blocked_asn_vpn = ARRAY[
  9009,
  20448,
  209854,
  136787,
  32751,
  212238,
  50525,
  207137,
  60729,
  398391,
  401401,
  401720,
  200373,
  198571,
  208172
]::integer[]
WHERE id = 1
  AND cardinality(blocked_asn_vpn) = 0;

-- Verify:
-- SELECT cardinality(blocked_asn_vpn), blocked_asn_vpn FROM helloworldjunktest.global WHERE id = 1;
