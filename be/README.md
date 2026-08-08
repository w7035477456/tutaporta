# OnlineMallWebsite API Server

Backend API server for the OnlineMallWebsite application.

## Setup

1. Install dependencies:

```bash
npm install
```

1. Create a `.env` file at `~/.ssh/be/.env` (e.g. `/Users/a/.ssh/be/.env` on Mac) with your PostgreSQL database credentials, SMTP settings, and AWS SMS configuration:

```
DB_HOST=localhost
DB_PORT=50010
DB_NAME=vsingles
DB_USER=postgres
DB_PASSWORD=[fix me]
# DB_SCHEMA: required, must be a non-public schema (e.g. helloworldjunktest)
DB_SCHEMA=helloworldjunktest
# PORT: optional here if you set API_PORT in ../fe/.env — loadEnv applies fe/.env API_PORT as the listen port
PORT=40000
JWT_SECRET=your-long-random-secret  # Use e.g. openssl rand -base64 32 (required in production)

# SMTP Configuration for sending registration emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NODE_ENV=development

# Rate limiting — in production, BACKEND_RATE_LIMIT_ENABLE must be true (see server_be.js).
# RATE_LIMIT_MAX = max requests per client IP per window, across ALL routes (not per URL).
# RATE_LIMIT_WINDOW_MINUTES = rolling window length in minutes.
# If unset, the server defaults to 100 requests / 15 minutes.
# Keep any comment in your own .env in sync with RATE_LIMIT_MAX (e.g. write "200/15" when RATE_LIMIT_MAX=200).
# BACKEND_RATE_LIMIT_ENABLE=true
# Legacy fallback still supported: RATE_LIMIT_ENABLE=true
# RATE_LIMIT_MAX=100
# RATE_LIMIT_WINDOW_MINUTES=15
# Higher cap if many legitimate clients share one public IP (NAT) and hit 429:
# RATE_LIMIT_MAX=200

# FE ↔ BE console trace: `FE_BE_TRAFFIC_LOG=true` logs HTTP + socket with `>>>>>` prefix in PM2 and browser DevTools. Optional `VITE_FE_BE_TRAFFIC_LOG=true` in fe/.env logs from first request before publicConfig loads. Restart Node after changing.

# Cache information_schema table/column probes in Node memory (myPicks, notifications, etc.). Default on.
# Set false and restart PM2 if migrations change schema and you need fresh probes without restart issues:
# CACHE_DB_SCHEMA_METADATA=false

# Redis for rate-limit store (optional; if unset, rate limit uses in-memory store per process)
# Store Redis URL and port in ~/.ssh/be/.env. Use one shared Redis server for many webservers (same limit per IP).
# When Redis is on its own server, set REDIS_URL to that host (e.g. redis://192.168.1.10:6379) or REDIS_HOST + REDIS_PORT.
# REDIS_URL=redis://localhost:6379
# Or:
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Log level for PM2 (optional; default INFO). Controls which messages are logged.
# Levels (most to least verbose): TRACE, DEBUG, INFO, WARN, ERROR, FATAL.
# Example: PM2_LOG_LEVEL=ERROR suppresses INFO (e.g. Redis health ping) and only logs ERROR/FATAL.
# PM2_LOG_LEVEL=DEBUG — shows [mobilePhotoUpload] QR/barcode upload trace (session create, phone scan, upload, desktop poll).
# PM2_LOG_LEVEL=INFO

# Restrict login to members with member_type >= 1 when true (optional; default false)
# LOCK_OUT=true  → only users with singles.member_type >= 1 can log in; others get a restricted-access message
# LOCK_OUT=false → login works as normal for all users
# LOCK_OUT=true

# AWS SMS (Pinpoint SMS Voice V2 / End User Messaging) — transactional OTP
# IAM user needs permission such as AmazonPinpointSMSVoiceV2FullAccess (or tighter custom policy).
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
# Origination: phone pool id (e.g. pool-269ca5b6573e42ebb325ca0d792506bb), simulator +1 number, or production long code
AWS_SMS_ORIGINATION_IDENTITY=pool-269ca5b6573e42ebb325ca0d792506bb
# Optional: Pinpoint / SNS configuration set for delivery events
# AWS_SMS_CONFIGURATION_SET_NAME=your-configuration-set

# Amazon Rekognition (My Self-Report-Bio → Start Check)
REKOGNITION_ENABLED=true
REKOGNITION_FACE_MATCH_THRESHOLD=90
REKOGNITION_LIVENESS_MIN_CONFIDENCE=90
REKOGNITION_REQUIRE_LIVENESS=true
# Cognito Identity Pool (guest) — required for browser liveness UI (same region as AWS_REGION)
# REKOGNITION_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# In AWS Console for that pool: enable "Guest access" / unauthenticated identities.
# Attach to the pool's *unauthenticated* IAM role (minimum):
#   rekognition:StartFaceLivenessSession on Resource "*"
# Backend IAM user/role still needs rekognition:CreateFaceLivenessSession (and CompareFaces, etc.).
# Liveness sessions are single-use — after "Server issue" or Try again, the app must start a new scan.
# Development only (skips liveness): REKOGNITION_REQUIRE_LIVENESS=false
# Verbose liveness/verify debug panel + console logs: REKOGNITION_DEBUG_UI=true
# Minutes before retry after failed liveness scan (default 5): LIVE_SCAN_COOLDOWN=5
# FE override: VITE_REKOGNITION_DEBUG_UI=true (default on in Vite dev mode)
```

**Redis (rate-limit store) – verify server is up**

1. **Check Redis is running** (same machine or your Redis server):
   ```bash
   redis-cli ping
   ```
   Expected: `PONG`. If `redis-cli` is not found, install Redis (e.g. `brew install redis` on Mac, `apt install redis-tools` on Ubuntu).

2. **If Redis is on another host**, use that host and port:
   ```bash
   redis-cli -h YOUR_REDIS_HOST -p 6379 ping
   ```
   Replace `YOUR_REDIS_HOST` with the value from `REDIS_HOST` in `~/.ssh/be/.env` (or the host in `REDIS_URL`).

3. **Start Redis** (if not running):
   - Mac: `brew services start redis` or `redis-server`
   - Ubuntu: `sudo systemctl start redis-server`
   - Docker: `docker run -d -p 6379:6379 --name redis redis`

4. **Why use a Redis server store?**  
   Redis is used for the rate-limit store so that **many webservers share one counter per IP**: the limit (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MINUTES`, default 100 / 15) is enforced globally, not per process. People use Redis for this because it is **very fast** (in-memory, simple key-value ops), supports **shared state** across many app instances, and is **reliable** for counters and short-lived data. Without Redis, each Node/PM2 process would have its own in-memory count, so one IP could hit `RATE_LIMIT_MAX` × (number of processes) requests.

**SMTP Setup (Gmail):**

- For Gmail, you need to use an App Password (not your regular password)
- Go to your Google Account settings → Security → 2-Step Verification → App passwords
- Generate an app password for "Mail" and use it as `SMTP_PASS`
- Use your Gmail address as `SMTP_USER`

**AWS SMS setup (signup phone verification):**

1. In **IAM**, create a user (or role on EC2) with permission to send via **Pinpoint SMS Voice V2** / End User Messaging (e.g. `AmazonPinpointSMSVoiceV2FullAccess` for setup; narrow later).
2. Create **access keys** for that user (or rely on the instance profile) and set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` (e.g. `us-east-1`).
3. In **AWS End User Messaging** → **Phone pools**, copy your **pool ID** or associated **originator** (simulator numbers like `+12065557224` work for sandbox dry runs; pair with AWS simulator destinations such as `+12065550100` per console docs).
4. Set `AWS_SMS_ORIGINATION_IDENTITY` to that pool id or phone number.
5. **Legacy DB only:** if you still use `pending_phone_verifications`, run `be/db/addPendingPhoneVerificationsSmsCode.sql` once so `sms_code` exists.

OTP codes are generated on the server, stored with the phone session, and sent in the message body. If AWS SMS env is incomplete, signup SMS endpoints return **500** until configured.

**Database schema (`vsingles` + non-`public` schema)**

- Set **`DB_SCHEMA`** in `~/.ssh/be/.env` to the schema that holds your app tables (e.g. `helloworldjunktest`, matching `\\dt` in psql).
- Source files use the `helloworldjunktest.*` prefix in SQL strings; **`be/db/connection.js` rewrites `helloworldjunktest.` to `"$DB_SCHEMA".`** at query time, so `verifications`, `singles`, etc. resolve to that schema. You do **not** need to duplicate tables in `public`.
- For **AWS SMS signup**, `helloworldjunktest.verifications` as you have it is enough: phone OTPs for `kind = 'phone_verify_session'` are stored in the existing **`code`** column (alongside email registration codes, which use a different `kind` and partial unique index).
- If your schema has **no** `pending_phone_verifications` table (typical for unified `verifications` only), **no DB migration is required** for SMS. Optional SQL under `be/db/addPendingPhoneVerificationsSmsCode.sql` is only for old installs that still use that legacy table.

**Verify SMTP credentials (without changing app code):**

1. **Confirm which env the app uses**  
   The backend loads from `~/.ssh/be/.env`. Your shell’s `showenv` may show a different env. After a sign-up attempt, check app logs for `[SMTP] Using: SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=jj****ii` to see exactly what the process is using.

2. **Test host and port** (no auth):
   ```bash
   openssl s_client -connect smtp.gmail.com:587 -starttls smtp -brief
   ```
   You should see a TLS handshake and connection; type `QUIT` and Enter to exit.

3. **Test full login (Gmail)**  
   From the machine where the app runs, run this from the **`be/`** directory. It loads `~/.ssh/be/.env` the same way the app does (via dotenv), so you don’t need to source the file in the shell:
   ```bash
   cd be
   node -e "
   const path = require('path');
   const os = require('os');
   require('dotenv').config({ path: path.join(os.homedir(), '.ssh', 'be', '.env') });
   const nodemailer = require('nodemailer');
   const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
   const host = process.env.SMTP_HOST || 'smtp.gmail.com';
   const port = process.env.SMTP_PORT || '587';
   const user = process.env.SMTP_USER || '';
   const mask = (p) => (p && p.length >= 4) ? p.slice(0,2) + '****' + p.slice(-2) : '(empty or short)';
   console.log('[SMTP] Using: SMTP_HOST=' + host + ' SMTP_PORT=' + port + ' SMTP_USER=' + user + ' SMTP_PASS=' + mask(pass));
   const t = nodemailer.createTransport({
     host: host,
     port: +port,
     secure: false,
     auth: { user: process.env.SMTP_USER, pass }
   });
   t.verify().then(() => console.log('SMTP OK')).catch(e => console.error('SMTP verify failed:', e.message));
   "
   ```
   If you see “Missing credentials for PLAIN”, the env file wasn’t loaded (check that `~/.ssh/be/.env` exists and has `SMTP_USER` and `SMTP_PASS`). If this fails with “Username and Password not accepted”, use a Gmail App Password (see [Google BadCredentials](https://support.google.com/mail/?p=BadCredentials)) and set it in `~/.ssh/be/.env` as `SMTP_PASS` (spaces optional; the app strips them).

4. **Gmail 535 / BadCredentials**  
   If you still get 535 after setting an App Password, ensure 2-Step Verification is on, the App Password is for “Mail”, and there are no typos or extra quotes in `~/.ssh/be/.env`. Restart the backend (e.g. `pm2 restart onlinemallwebsite`) so it reloads the file.

1. Set up the database:
  - Create a PostgreSQL database (if not already created)
  - Run the schema file to create the table:
   Or if using a different database name:
2. (Optional) Seed the database with sample data:

```bash
npm run seed
```

1. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

- `GET /api/allSingles` - Get all singles from the database
- `GET /health` - Health check endpoint

## Database Schema

The server expects a `singles` table with the following columns:

- `id` (integer)
- `firstname` (varchar)
- `job_title` (varchar)
- `description` (text)
- `email` (varchar)
- `phone` (varchar)
- `location` (varchar)
- `profile_image_url` (varchar)
- `created_at` (timestamp)
- `updated_at` (timestamp)

