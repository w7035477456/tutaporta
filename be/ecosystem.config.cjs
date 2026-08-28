/**
 * PM2 ecosystem config (from originalProject1 setup).
 * Run: npm run pm2:start  or  pm2 start ecosystem.config.cjs
 * Start from be/ so cwd is correct. Env is loaded from ~/.ssh/be/.env (no project .env).
 *
 * pm2-logrotate (retain 7 days):
 *   Install once: pm2 install pm2-logrotate
 *   Then set:     pm2 set pm2-logrotate:retain 7
 *   Optional:     pm2 set pm2-logrotate:max_size 10M
 *                 pm2 set pm2-logrotate:compress true
 *   Retain 7 keeps 7 rotated files (e.g. ~7 days if rotating daily).
 */
const path = require('path');
module.exports = {
  apps: [{
    name: 'onlinemallwebsite',
    script: './server_be.js',
    cwd: path.join(__dirname),
    // Single worker: TutaPhoto / TutaNote hold the member's SQLite vault open in
    // process memory. With 2+ round-robin workers each one gets its own copy of
    // vault.db, so notes created on one worker are "Note not found" on the other
    // and whichever flushes last overwrites the rest.
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '12G',
    env: {
      NODE_ENV: 'development',
      PORT: 40000,
      LOG_LEVEL: 'debug',
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 40000,
      LOG_LEVEL: 'info',
      NODE_OPTIONS: '--max-old-space-size=32768',
    },
    out_file: './logs/app-out.log',
    error_file: './logs/app-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 60000,
    kill_timeout: 3000,
    wait_ready: false,
    listen_timeout: 50000,
    cron_restart: '0 3 * * *',
  }],
};
