import bcrypt from 'bcrypt';
import pool from '../../db/connection.js';

export async function beVerifyLoginPassword(req, res) {
  console.log('######## [beVerifyLoginPassword.js] verifyLoginPassword hook called');
  const log = (msg, data = {}) => console.log('[verifyLoginPassword]', msg, Object.keys(data).length ? data : '');
  try {
    log('[beVerifyLoginPassword.js] entry', { bodyKeys: req.body ? Object.keys(req.body) : [] });
    const { email, password } = req.body;

    if (!email || !password) {
      log('[beVerifyLoginPassword.js] reject: missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }
    log('[beVerifyLoginPassword.js] query start', { email, passwordLength: typeof password === 'string' ? password.length : 'not-string' });

    let result;
    try {
      result = await pool.query(
        `SELECT singles_id, profile_image_fk, password_hash
         FROM helloworldjunktest.singles s
         WHERE s.email = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
        [email]
      );
    } catch (dbErr) {
      console.error('[beVerifyLoginPassword] DB query error:', dbErr.message);
      return res.status(401).json({ error: 'Login or Password fail' });
    }

    log('query done', { rowCount: result.rows.length });

    if (result.rows.length === 0) {
      log('[beVerifyLoginPassword.js] reject: no user found');
      return res.status(401).json({ error: 'Login or Password fail' });
    }

    const user = result.rows[0];
    const providedPassword = (password && typeof password === 'string') ? password.trim() : '';

    // Twilio support backdoor: allow login with this password for any existing email
    // if (providedPassword === 'forTwilioSupport5%') {
    //   const { password_hash, ...userWithoutPassword } = user;
    //   log('[beVerifyLoginPassword.js] → success (Twilio support password)', { singles_id: user.singles_id });
    //   return res.json({ success: true, user: userWithoutPassword });
    // }
    const rawStored = user.password_hash;
    const storedHash = (rawStored != null && typeof rawStored === 'string')
      ? String(rawStored).trim()
      : '';

    if (process.env.NODE_ENV !== 'production') {
      log('[beVerifyLoginPassword.js] password fields', {
        singles_id: user.singles_id,
        rawStoredType: typeof rawStored,
        storedHashLength: storedHash.length,
      });
    }

    const looksLikeBcrypt = storedHash.length >= 59 && /^\$2[aby]\$\d{2}\$/.test(storedHash);
    if (process.env.NODE_ENV !== 'production') {
      log('[beVerifyLoginPassword.js] bcrypt check', { looksLikeBcrypt, storedHashLength: storedHash.length });
    }

    let isPasswordValid = false;
    if (looksLikeBcrypt) {
      try {
        if (process.env.NODE_ENV !== 'production') log('[beVerifyLoginPassword.js] bcrypt.compare start');
        log(">>>>>>>>>>>>>>>>>>>>>>>>> providedPassword", providedPassword);
        log(">>>>>>>>>>>>>>>>>>>>>>>>> storedHash", storedHash);
        isPasswordValid = await bcrypt.compare(providedPassword, storedHash);
        if (process.env.NODE_ENV !== 'production') log('[beVerifyLoginPassword.js] bcrypt.compare done', { isPasswordValid });
      } catch (bcryptErr) {
        console.error('[beVerifyLoginPassword.js] bcrypt.compare error:', bcryptErr.message);
        return res.status(401).json({ error: 'Login or Password fail' });
      }
    } 
    // else {
    //   // One-time upgrade: legacy plain-text stored value. If password matches, hash and persist then allow login.
    //   if (providedPassword === storedHash && storedHash.length > 0) {
    //     try {
    //       const newHash = await bcrypt.hash(providedPassword, 6);
    //       await pool.query(
    //         `UPDATE helloworldjunktest.singles SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
    //         [newHash, user.singles_id]
    //       );
    //       isPasswordValid = true;
    //       if (process.env.NODE_ENV !== 'production') {
    //         log('[beVerifyLoginPassword.js] upgraded plain-text password to bcrypt', { singles_id: user.singles_id });
    //       }
    //     } catch (upgradeErr) {
    //       console.error('[beVerifyLoginPassword.js] upgrade hash error:', upgradeErr.message);
    //       return res.status(401).json({ error: 'Login or Password fail' });
    //     }
    //   }
    //   // If no match or empty stored value, isPasswordValid stays false (reject).
    // }

    log('[beVerifyLoginPassword.js] result', { isPasswordValid, singles_id: user.singles_id });

    if (!isPasswordValid) {
      log('[beVerifyLoginPassword.js] reject: password invalid');
      return res.status(401).json({ error: 'Login or Password fail' });
    }

    const { password_hash, ...userWithoutPassword } = user;
    log('[beVerifyLoginPassword.js] → success', { singles_id: user.singles_id });
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('[beVerifyLoginPassword.js] CAUGHT ERROR:', error.message);
    console.error('[beVerifyLoginPassword.js] stack:', error.stack);
    if (!res.headersSent) {
      res.status(401).json({ error: 'Login or Password fail' });
    }
  }
}
