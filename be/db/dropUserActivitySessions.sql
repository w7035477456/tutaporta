-- Drop legacy login/active-time session tracking (idle logout is FE-only; single-login uses Redis).
-- Run on Primary only.

DROP TABLE IF EXISTS helloworldjunktest.user_activity_sessions CASCADE;
