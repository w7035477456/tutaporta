# Build: Tutamall Application Intrusion Detection Agent

## Goal
Implement an **application-layer Intrusion Detection Agent** for Tutamall, modeled on the existing chat scam agent (`be/utils/chatScamDetect.js` + Admin Scam Alert).

This is NOT a host IDS (not fail2ban, not packet sniffing, not SSH log watching). It detects **abuse, probing, account takeover attempts, and app-level attack patterns** from signals inside the Node BE + Postgres, then creates durable admin alerts.

Name it clearly in code/UI, e.g. **Intrusion Detect** / `intrusionDetect`.

## Non-negotiable architecture (mirror scam agent)

1. **No separate process / cron daemon.** Agent code lives in the BE process (PM2 / beall).
2. **Event-driven fire-and-forget:** after a security-relevant event is recorded, call `scheduleIntrusionScan(...)` and return the HTTP response immediately. Never block login/signup/API on LLM latency.
3. **Optional light reconcile tick** on BE startup (`setInterval`, e.g. every 1–5 minutes) ONLY for:
   - expiring stale rolling counters
   - escalating open alerts that keep accumulating
   - sweeping “slow” multi-window attacks
   Do NOT make detection depend only on a nightly cron.
4. **Rules first, LLM second:**
   - Deterministic detectors compute scores / categories / evidence from counters & events.
   - Optional Ollama call (reuse patterns from `chatScamDetect.js` / `llmGatewayClient.js`) ONLY to produce a short admin-facing summary + suggested severity narrative. LLM must NOT be the sole gate for creating an alert when hard thresholds are crossed.
5. **Cluster-safe:** web servers are round-robin / stateless. Use Primary Postgres atomic claims (like `chat_scam_scan`) so only one server “owns” a given scan key. No in-process-only memory for cross-request state that must be shared (use Postgres; Redis OK if already standardized with TTL).
6. **Schema:** ONLY `outdateddbsnapshotoct2024` — never `public`. Qualify all tables.
7. **Writes / DDL → Primary.** Apply Mac DDL AND Ubuntu via `scripts/ubuntu-psql.sh`, then run `isdbsame` and report `same`.
8. **Secrets:** never print or commit `~/.ssh/be/.env` values. Use env flags for enable/thresholds/model.
9. **Admin UX:** new Admin Tools tab parallel to Scam Alert (list / filter / open-confirm-dismiss / admin note). Reuse ColorTemplate / existing admin patterns; do not invent a new design system.
10. **Default action policy = ALERT ONLY** in v1:
    - Create `intrusion_alert` rows
    - Append a durable log file (like scamlog) under the configured log location pattern used elsewhere
    - Do NOT auto-ban IPs or auto-suspend members in v1 unless behind an explicit env kill-switch defaulting OFF
    - Optional later hooks: suggest suspend / show “recommended action” — human confirms (reuse suspend-lock patterns from scam admin if applicable)

## Reference implementation to copy patterns from
- `be/utils/chatScamDetect.js` — schedule/run/claim/alert/admin list/update, SYSTEM_PROMPT, Ollama call, coalescing inFlight map
- `be/routes/admin/adminScamAlerts.js` + `fe/src/views/utilities/AdminToolsScamAlertTab.jsx`
- `be/db/addChatScamAlertTables.sql` + protect-delete pattern if alerts must be permanent
- `be/utils/loginLog.js`, `be/routes/admin/adminLoginLogLookup.js`, Admin Login Log + ASN tabs
- `be/utils/clientDeviceInfo.js`, login session device class helpers
- Note: backend rate limiting was removed (`server_be.js`); do not assume it exists — agent must work from logged events / new instrumentation you add

## Deliverables
1. `be/db/addIntrusionDetectTables.sql` (and any follow-up SQL) — safe to re-run
2. `be/utils/intrusionDetect.js` — config, detectors, schedule/run, LLM summary, alert CRUD helpers
3. Instrumentation hooks in auth / sensitive routes (see Triggers)
4. Admin API routes under `/api/admin/intrusion-alerts/*` + wire in `server_be.js`
5. FE Admin Tools tab + route/tab registration
6. Env knobs documented in code comments (not a new markdown doc unless repo already documents similarly)
7. Unit tests for pure detector scoring where practical (threshold math, windowing, category assignment)
8. Mac + Ubuntu schema applied; `isdbsame` → `same`

## Suggested tables (adjust names to match repo style)

### `outdateddbsnapshotoct2024.intrusion_event`
Append-only security event stream (app-layer telemetry). At minimum:
- `intrusion_event_id` bigserial/bigint PK
- `created_at timestamptz`
- `event_type text` (enum or check-constrained list — see categories below)
- `severity_hint int` nullable (emitter may leave null; agent fills)
- `singles_id bigint` nullable
- `email/phone` nullable (for pre-auth)
- `client_ip inet/text` nullable
- `user_agent text` nullable
- `device_type / browser / os` nullable if easily available
- `path` / `http_method` nullable
- `status_code` int nullable
- `route_group` text nullable (auth, admin, vault, chat, api, static)
- `session_token_hash` or session id ref nullable (do not store raw secrets)
- `meta jsonb` (structured extras: asn, country if present, reason codes, target singles_id, etc.)
- indexes on `(created_at DESC)`, `(client_ip, created_at DESC)`, `(singles_id, created_at DESC)`, `(event_type, created_at DESC)`

### `outdateddbsnapshotoct2024.intrusion_counter`
Rolling aggregate keys for fast threshold checks (Primary writes):
- key dimensions: e.g. `ip`, `ip+path`, `singles_id`, `email`, `ip+singles_id`
- window bucket (e.g. 1-minute / 5-minute / 1-hour)
- counts by event_type or total failures
- `updated_at`
- Use upserts; reconcile tick expires old buckets

### `outdateddbsnapshotoct2024.intrusion_scan`
Claim / last-run state per scan subject key (ip, account, or composite), analogous to `chat_scam_scan`.

### `outdateddbsnapshotoct2024.intrusion_alert`
Durable alerts (prefer permanent like scam alerts — prevent DELETE via trigger if that matches project policy):
- alert id, created_at, updated_at
- status: `open` | `confirmed` | `dismissed`
- category (primary), categories[] or tags
- risk_score 0–100
- title, reason, evidence jsonb, event_ids[], counter snapshot jsonb
- subject: client_ip, singles_id, email, path pattern
- llm_summary, llm_model
- detection_count, admin_note
- first_event_at, last_event_at
Indexes for admin list + open-by-ip / open-by-member

## Config (env)
- `INTRUSION_DETECT_ENABLED` default true
- `INTRUSION_DETECT_LLM_SUMMARY_ENABLED` default false or true (your choice; document)
- model / timeout knobs parallel to CHAT_SCAM_*
- threshold overrides per detector family
- `INTRUSION_DETECT_AUTO_LOCK_ENABLED` default false (v1 unused or no-op)
- skip-list reuse/extend `ipLogSkipList` for demo/local IPs that must not alert noise

## Triggers — instrument these emitters
Wherever the BE today accepts identity or sensitive actions, emit `intrusion_event` then `scheduleIntrusionScan(subjectKey)`:

### A. Authentication / identity
1. Failed password / failed OTP / failed magic-link / invalid credentials (ADD this if not logged today — `login_log` currently is mainly demo_login + signup; failed auth MUST be instrumented)
2. Successful login after recent failures (spray then success)
3. Login success from new IP / new device class vs member history
4. Concurrent sessions from distant geos/ASNs in short window (if geo/ASN available; else IP-distance heuristic / device mismatch)
5. Session token reuse anomalies / session superseded bursts
6. Password reset request floods per email/IP
7. Password reset completion from IP different from request IP
8. Signup floods per IP / UA / phone prefix
9. Signup with disposable patterns if already detectable in codebase
10. OAuth login anomalies (state mismatch, callback errors) if Google signup/OAuth routes exist
11. Demo/guest credential abuse spikes (demo/demo) if relevant
12. Admin role login success/failure specially tagged

### B. Authorization / probing
13. HTTP 401 spikes per IP
14. HTTP 403 spikes per IP (authenticated but forbidden)
15. Hits to Admin API without admin role
16. Enumeration: sequential singles_id / member_id / album id / note id probing (404/403 patterns)
17. Method anomalies (unexpected PUT/DELETE volume)
18. Path fuzzing: many distinct unknown paths from one IP in short window
19. Hitting disabled/under-construction mall department APIs repeatedly

### C. Account takeover / session
20. Change-email / change-phone / change-password attempts (fail + success)
21. Sudden password change then mass sensitive actions
22. JWT/auth header malformed floods
23. Refresh/session endpoints abused
24. “Logout all sessions” followed by login elsewhere (if exists)

### D. Vault / notes / photos (high value)
25. Vault unlock failures (wrong passphrase / unlock denial)
26. Vault unlock success after failures
27. Vault unlock from new IP/device
28. Mass note/photo list or download patterns atypical for user
29. USB bridge / local agent endpoint abuse if exposed beyond localhost assumptions
30. RAG / record-vault routes flooded
31. Backup download / user-backup endpoint abuse (`tutaMallUserBackup`)

### E. Chat / social abuse that looks like intrusion (not romance scam — different agent)
32. Mass message send to many distinct targets from one account (spam botnet)
33. API chat send failures storms
34. Scraping buddy lists / profile endpoints at high RPS

### F. Marketplace / classifieds / flowers (if routes exist)
35. Checkout/payment endpoint hammering
36. Seller/admin BPM endpoints probed by non-roles

### G. Admin & ops surfaces
37. Admin Tools API brute force / scanning
38. ASN/login-log/scam-alert admin endpoints accessed by non-admin (should 403 — still event)
39. Repeated access to wipe/dangerous admin actions

### H. API / edge abuse
40. Extremely high request rate per IP to `/api/*` (implement lightweight counters even though old rate-limit system was removed — counters for detection, not necessarily enforcement in v1)
41. Large body / suspicious content-type storms if cheap to detect
42. Replay of identical auth payloads
43. Client IP changing every request within same session token (possible proxy hopping / stolen session use)

### I. Data exfil patterns
44. Bulk export/list endpoints consuming large pages rapidly
45. Repeated access to other users’ resources (IDOR attempts) — count distinct foreign resource IDs denied

### J. Supply / integrity signals (app-visible only)
46. Feature-flag / env-dependent endpoints returning errors in patterns that look like exploit attempts
47. Unexpected spikes in 5xx correlated with one IP (exploit crash attempts) — alert carefully to avoid noise from real outages

For each emitter: record event first, schedule scan second, never throw to caller from scheduler.

## Detection catalog the agent MUST implement (rules)
Implement explicit detectors with documented thresholds (env-overridable). Each produces category + risk_score + evidence.

### 1) Credential stuffing / password spray
- Many failed logins across many emails from one IP
- Many failed logins for one email across many IPs
- Distinct username count high, low success rate

### 2) Brute force (single account)
- N failures for same singles_id/email in T minutes
- Failures then success (compromise-likely)

### 3) Credential stuffing success
- Success from IP that failed against many other accounts recently

### 4) Signup / registration flood
- N signups / signup attempts per IP or UA in T
- Same phone/email pattern collisions if applicable

### 5) Password reset abuse
- Reset request volume per IP/email
- Token attempt failures

### 6) Session hijack / anomaly
- Existing session used from new IP/UA suddenly
- Parallel sessions impossible-travel if data exists; else “new device + sensitive action”

### 7) Admin probe
- Unauthenticated or non-admin calls to `/api/admin/*`
- Burst of distinct admin paths

### 8) API enumeration / IDOR
- Many 403/404 on resource IDs
- Sequential ID access patterns

### 9) Path / vulnerability scanning
- Large distinct path cardinality from one IP
- Common scanner path hits if they reach Node (e.g. wordpress/php probes) — categorize as `vuln_scan`

### 10) Rate / volumetric abuse
- Requests/min over threshold per IP or per account
- Chat send fan-out

### 11) Vault intrusion
- Unlock fail bursts
- Unlock fail then success
- New IP unlock + backup/download

### 12) Privilege escalation attempts
- Role-gated actions denied repeatedly
- Attempts to set admin/member_category if such APIs exist

### 13) Token / auth artifact attacks
- Malformed JWT floods
- Auth header garbage storms

### 14) Account takeover playbook combo (composite high risk)
Combine signals into elevated category `ato_suspected` when 2+ of:
- new IP/device login
- password reset or password change
- vault unlock
- email/phone change
- bulk export
within a short window

### 15) Bot / automation signals
- Extremely low UA diversity or empty UA with high volume
- Exact interval timing if cheap
- Known bad UA substrings (curl/scrapy/sqlmap) as soft signals — never sole reason at high severity without volume

### 16) Geo/ASN anomalies (when ASN tooling/data available)
- Login ASN differs from member’s recent ASNs strongly
- Hosting/cloud ASN + failed auth bursts tagged `cloud_bruteforce`

### 17) Demo/pilot noise control
- Respect IP skip list
- Down-rank or ignore localhost / documented office IPs
- Do not alert on HEALTH checks

### 18) Slow attacks (reconcile tick)
- Sub-threshold activity that accumulates over 1 hour / 24 hour windows
- Detector for “low and slow” brute force

## Categories (store on alerts)
Use a fixed set similar to scam categories, e.g.:
`credential_stuffing`, `brute_force`, `password_spray`, `signup_flood`, `password_reset_abuse`, `session_anomaly`, `admin_probe`, `idor_enumeration`, `vuln_scan`, `rate_abuse`, `vault_intrusion`, `privilege_escalation`, `token_attack`, `ato_suspected`, `bot_automation`, `asn_anomaly`, `exfil_pattern`, `other`

## Risk scoring
- 0–100 integer
- Hard threshold env default e.g. 70 creates/updates alert
- Composite detectors can jump to 85–95
- Evidence must include timestamps, counts, windows, example event ids, paths, IPs, singles_ids
- Dismissed alerts must not reopen on the same old evidence (copy scam-agent dismissal semantics)

## LLM summary (optional)
SYSTEM_PROMPT: you are a security analyst for Tutamall. Given structured detector evidence JSON (NOT raw secrets/passwords), return JSON:
`{ "summary": "...", "recommended_actions": ["..."], "confidence": 0-100 }`
Never invent events not in evidence. Keep summary short for Admin UI.

## Admin API / UI requirements
- GET/list with status filter (open/confirmed/dismissed)
- PATCH status + admin_note
- Optional POST manual rescan by ip or singles_id (force)
- Show: risk, category, IP, member, first/last seen, evidence, LLM summary, detection_count
- Link out to Login Log lookup when singles_id/IP present if easy
- Register tab in `AdminToolsPage.jsx` like scam-alert

## Safety / product constraints
- Never log passwords, tokens, vault passphrases, full Authorization headers, or SSH key material
- Hash or truncate session identifiers
- Do not break login flows if detector throws
- Feature-flag off = zero behavior change except no-ops
- Performance: coalescing per subject key (inFlight map like scam) + DB claim
- Avoid alert storms: coalesce into one open alert per subject+category; bump detection_count / update evidence
- Distinguish this agent from chat scam agent (do not overload chat_scam_alert)

## Out of scope for v1 (document in code comments)
- Host SSH intrusion, fail2ban, nftables, HAProxy log parsing, Cloudflare WAF config
- Auto IP ban at firewall
- Full SIEM
- Packet capture
These may be future inputs into `intrusion_event` via a small ingest endpoint later — design `intrusion_event` so external sensors could POST events later with admin auth, but do not build host collectors in v1.

## Implementation order
1. SQL tables + enums
2. `intrusionDetect.js` core (emit helper, counters, detectors, schedule/run, alerts)
3. Instrument failed/successful auth + admin 403 + vault unlock failures (highest value first)
4. Admin API + FE tab
5. Add remaining emitters progressively
6. Optional LLM summary
7. Tests for scoring
8. Ubuntu schema + `isdbsame`

## Acceptance criteria
- With detect enabled, N failed logins from one IP in window creates an open `intrusion_alert` visible in Admin Tools without blocking the login response
- Second burst updates same open alert (detection_count++) rather than spamming duplicates
- Dismissed alert does not reopen unless new evidence after dismissal
- Cluster: two app servers don’t double-create for same claim key
- Env off → no events scheduled (or emit disabled), no alerts
- Schema only in `outdateddbsnapshotoct2024`; Mac/Ubuntu `isdbsame` prints `same`
- Code mirrors scam-agent style: readable, minimal new abstractions, no drive-by refactors

## Explicit non-goals
- Do not reintroduce a full user-facing rate-limit product unless needed for counters
- Do not edit `myscript/**/b`
- Do not commit secrets
- Do not ask multiple-choice questions — implement the recommended path

Build it now end-to-end.