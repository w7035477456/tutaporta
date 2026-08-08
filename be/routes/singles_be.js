import crypto from 'crypto';
import pool from '../db/connection.js';
import nodemailer from 'nodemailer';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../lib/emailHtml.js';
import { isAwsSmsConfigured, sendTransactionalSms } from '../lib/awsPinpointSms.js';
import { generateSixDigitOtp, safeEqualOtp } from '../lib/smsOtp.js';
import { DEFAULT_NEW_USER_THEME } from '../lib/defaultNewUserPreferences.js';
import { insertNewSinglesAccount } from '../utils/newSinglesAccount.js';
import { normalizeEmailForDb } from '../utils/normalizeEmailForDb.js';
import { recordAuditRegistrationChange } from '../utils/insertAuditRegistration.js';
import { referCodeFromMemberId } from '../utils/referCodeFromMemberId.js';
import { resolveReferByCode } from '../utils/referByCode.js';
import { verifyPassword } from '../utils/passwordHash.js';
import { sqlInterestedIsTrue } from './singles/interestedSql.js';
import { sqlBooleanEnumColumnAsBool, sqlBooleanEnumLiteral } from '../utils/booleanEnum.js';
import {
  TOKEN_EXPIRY_MS,
  storeCreatePasswordToken,
  consumeCreatePasswordToken,
  storePendingVerification,
  getPendingVerification,
  deletePendingVerification
} from '../utils/signupPendingStore.js';

export const registerUser_FFFFFFFF = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if SMTP is configured (Gmail app password: strip spaces if stored as "xxxx xxxx xxxx xxxx")
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isSmtpConfigured = smtpUser && smtpPass && 
                             smtpUser !== 'your-email@gmail.com' && 
                             smtpPass !== 'your-app-password';

    // Log SMTP config the process is using (mask password)
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || '587';
    const maskPass = (p) => (p && p.length >= 4) ? p.slice(0, 2) + '****' + p.slice(-2) : '(not set or too short)';
    console.log('[SMTP] Using: SMTP_HOST=' + smtpHost + ' SMTP_PORT=' + smtpPort + ' SMTP_USER=' + (smtpUser || '(not set)') + ' SMTP_PASS=' + maskPass(smtpPass));

    // Only send email if SMTP is properly configured
    if (isSmtpConfigured) {
      // Create a transporter for sending emails
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      // Generate secure single-use token so only the person who received the email can create password
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
      await storeCreatePasswordToken(token, email, expiresAt);
      const createPasswordLink = `https://OnlineMall.Website/pages/createPassword?token=${token}&email=${encodeURIComponent(email)}`;
      const mailOptions = enrichMailOptions({
        from: OUTBOUND_EMAIL_FROM_HEADER,
        to: email,
        subject: 'Complete Your Registration - Create Password',
        html: wrapEmailHtml(`
            <h2 style="color: #333;">Welcome to VSingles!</h2>
            <p>Thank you for registering. To complete your registration, please create your password by clicking the link below:</p>
            <p style="margin: 20px 0;">
              <a href="${createPasswordLink}" 
                 style="display: inline-block; padding: 12px 24px; background-color: ${process.env.THEME_PRIMARY_HEX || 'var(--theme-primary-color)'}; color: white; text-decoration: none; border-radius: 4px;">
                Create Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${createPasswordLink}</p>
            <p style="margin-top: 30px; color: #999; font-size: 12px;">
              If you did not register for this account, please ignore this email.
            </p>
          `)
      });

      // Send email
      try {
        await transporter.sendMail(mailOptions);
        console.log('Registration email sent to:', email);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        
        // Check for Gmail App Password error
        let errorMessage = emailError.message || 'Please check your SMTP configuration and try again.';
        let errorDetails = '';
        
        if (emailError.code === 'EAUTH' || 
            (emailError.message && emailError.message.includes('Application-specific password required'))) {
          errorDetails = 'Gmail requires an App Password when 2FA is enabled. ' +
            'Go to: Google Account → Security → 2-Step Verification → App passwords. ' +
            'Generate an app password for "Mail" and use it as SMTP_PASS in ~/.ssh/be/.env.';
        } else if (emailError.message) {
          errorDetails = emailError.message;
        }
        
        // Always fail if email can't be sent - user needs the email to continue
        return res.status(500).json({ 
          error: 'Failed to send registration email',
          details: errorDetails || errorMessage
        });
      }
    } else {
      // SMTP not configured - return error in both development and production
      console.error('SMTP not configured. Cannot send registration email.');
      console.error('Please configure SMTP_USER and SMTP_PASS in ~/.ssh/be/.env.');
      return res.status(500).json({ 
        error: 'Email service not configured. Cannot send registration email.',
        details: 'Please configure SMTP_USER and SMTP_PASS in ~/.ssh/be/.env. For Gmail, you need to use an App Password.'
      });
    }

    res.json({ 
      success: true, 
      message: 'Registration email sent successfully' 
    });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ error: 'Failed to process registration' });
  }
};

export const verifyLoginPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Query singles table (same DB as in ~/.ssh/be/.env: DB_NAME must match where your data lives, e.g. vsingles)
    const result = await pool.query(
      `SELECT 
        singles_id, 
        profile_image_fk,
        password_hash
      FROM helloworldjunktest.singles s 
      WHERE s.email = $1
      ORDER BY COALESCE(s.updated_at, s.created_at) DESC
      LIMIT 1`,
      [normalizeEmailForDb(email)]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Login or Password fail'
      });
    }

    const user = result.rows[0];
    const providedPassword = (password && typeof password === 'string') ? password.trim() : '';
    const storedHash = user.password_hash?.trim() || '';

    // Support Argon2id, bcrypt, and plain text (legacy)
    const isPasswordValid = await verifyPassword(storedHash, providedPassword);

    // Temporary debug: remove once login works
    console.log('Login attempt:', { email, gotRow: true, singles_id: user.singles_id, storedHashPreview: storedHash.slice(0, 20) + (storedHash.length > 20 ? '...' : ''), isPasswordValid });

    if (!isPasswordValid) {
      // Password is wrong
      return res.status(401).json({ 
        error: 'Login or Password fail'
      });
    }

    // Remove password_hash from response for security
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Error verifying login:', error);
    res.status(500).json({ error: 'Failed to verify login' });
  }
};




export const getAllSingles_BBBBBBBB = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        singles_id, 
        profile_image_fk
      FROM helloworldjunktest.singles s 
      ORDER BY s.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching singles:', error);
    res.status(500).json({ error: 'Failed to fetch singles from database' });
  }
};

export const getSinglesInterested_DDDDDDD = async (req, res) => {
  try {
    // Try query with interested field (boolean or date)
    let result;
    try {
      result = await pool.query(`
        SELECT
          r.singles_id_to,
          s.singles_id,
          s.profile_image_fk,
          s.vetted_basic_status
        FROM helloworldjunktest.requests r
               JOIN helloworldjunktest.singles s ON r.singles_id_to = s.singles_id
        WHERE ${sqlInterestedIsTrue('r')}
        ORDER BY s.created_at DESC;
      `);
    } catch (fieldError) {
      console.error('Error fetching singles:', error);
      res.status(500).json({ error: 'Failed to fetch singles from database' });
    }

    console.log('Backend - result.rows:', JSON.stringify(result.rows, null, 2));
    console.log('Backend - first row:', result.rows[0]);
    console.log('Backend - first row keys:', result.rows[0] ? Object.keys(result.rows[0]) : 'no rows');

    // Ensure singles_id_to is always present, use singles_id as fallback
    // Convert to string to ensure consistent type
    const processedRows = result.rows.map((row) => {
      const idValue = row.singles_id_to ?? row.singles_id;
      return {
        singles_id_to: idValue != null ? String(idValue) : null,
        profile_image_fk: row.profile_image_fk ?? null,
        vetted_basic_status: row.vetted_basic_status === true || row.vetted_basic_status === 'true' || row.vetted_basic_status === 1
      };
    }).filter((row) => row.singles_id_to != null); // Filter out any rows with null IDs

    console.log('Backend - processedRows:', JSON.stringify(processedRows, null, 2));
    res.json(processedRows);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Database error' });
  }


};

export const createPassword_GGGGGGGG = async (req, res) => {
  try {
    const { token, email, password, phone } = req.body;

    if (!token || !email || !password || !phone) {
      return res.status(400).json({ error: 'Invalid link. Please use the link from your registration email.' });
    }

    // Consume token first so a second round-robin hit cannot reuse the same link.
    const stored = await consumeCreatePasswordToken(token);
    if (!stored) {
      return res.status(400).json({ error: 'This link is invalid or has already been used. Please request a new registration email.' });
    }
    const restoreToken = async () => {
      const ttlSec = Math.max(1, Math.ceil((Number(stored.expiresAt) - Date.now()) / 1000));
      if (Number.isFinite(ttlSec) && ttlSec > 0) {
        await storeCreatePasswordToken(token, stored.email, stored.expiresAt);
      }
    };
    if (normalizeEmailForDb(stored.email) !== normalizeEmailForDb(email)) {
      await restoreToken();
      return res.status(400).json({ error: 'Invalid link. Please use the link from your registration email.' });
    }
    if (Date.now() > stored.expiresAt) {
      return res.status(400).json({ error: 'This link has expired. Please request a new registration email.' });
    }

    // Validate phone format (remove formatting)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      await restoreToken();
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }

    // Format phone as +1XXXXXXXXXX for SMS (US numbers)
    const formattedPhone = `+1${phoneDigits}`;

    console.log('=== CREATE PASSWORD - SMS VERIFY ===');
    console.log('Email:', email);
    console.log('Phone:', formattedPhone);
    console.log('AWS SMS configured:', isAwsSmsConfigured());
    console.log('========================================');

    if (!isAwsSmsConfigured()) {
      console.error('❌ SMS provider not configured.');
      await restoreToken();
      return res.status(500).json({
        error: 'SMS service not configured (v1)',
        details:
          'Configure AWS_SMS_ORIGINATION_IDENTITY, AWS_REGION, and AWS credentials in ~/.ssh/be/.env'
      });
    }

    try {
      const smsOtp = generateSixDigitOtp();
      const body = `Your verification code is: ${smsOtp}`;
      await sendTransactionalSms(formattedPhone, body);

      console.log(`✅ SMS verification sent to ${formattedPhone}`);

      // Store user data and OTP for later use in verification
      await storePendingVerification(email, formattedPhone, {
        password: password,
        email: email,
        phone: formattedPhone,
        smsOtp
      });

      res.json({ 
        success: true, 
        message: 'Verification code sent to your phone' 
      });
    } catch (error) {
      console.error('❌ Error sending SMS verification:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo
      });
      await restoreToken();
      return res.status(500).json({ 
        error: 'Failed to send verification SMS',
        details: error.message || 'Please check SMS provider configuration.'
      });
    }
  } catch (error) {
    console.error('Error in createPassword:', error);
    res.status(500).json({ error: 'Failed to process password creation' });
  }
};

export const verifyPhone_HHHHHHHH = async (req, res) => {
  try {
    const { email, phone, verificationCode: verificationCodeRaw, referByCode: referByCodeRaw, ref: refRaw } = req.body;
    const resolvedReferByCode = resolveReferByCode(referByCodeRaw ?? refRaw);

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email, phone, and verification code are required' });
    }

    // Normalize verification code: string, trim, digits only
    const verificationCode = String(verificationCodeRaw ?? '')
      .trim()
      .replace(/\D/g, '');
    if (!verificationCode || verificationCode.length !== 6) {
      return res.status(400).json({
        error: 'Invalid verification code',
        details: 'The verification code must be exactly 6 digits.'
      });
    }

    // Format phone
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }
    const formattedPhone = `+1${phoneDigits}`;

    console.log('=== VERIFY PHONE - SMS VERIFY ===');
    console.log('Email:', email);
    console.log('Phone:', formattedPhone);
    console.log('Verification Code:', verificationCode);
    console.log('AWS SMS configured:', isAwsSmsConfigured());
    console.log('====================================');

    if (!isAwsSmsConfigured()) {
      console.error('❌ SMS provider not configured');
      return res.status(500).json({
        error: 'SMS service not configured (v2)',
        details: 'Configure AWS_SMS_ORIGINATION_IDENTITY and AWS credentials in ~/.ssh/be/.env'
      });
    }

    const storedData = await getPendingVerification(email, formattedPhone);

    if (!storedData) {
      return res.status(400).json({ error: 'Verification session not found. Please start the verification process again.' });
    }

    if (!storedData.smsOtp || !safeEqualOtp(verificationCode, storedData.smsOtp)) {
      console.log('❌ Verification code check failed.');
      return res.status(400).json({
        error: 'Invalid verification code',
        details: 'The verification code is incorrect. Please try again.'
      });
    }

    try {
      const existingUser = await pool.query(
        'SELECT singles_id, member_id FROM helloworldjunktest.singles WHERE email = $1',
        [normalizeEmailForDb(email)]
      );

      if (existingUser.rows.length > 0) {
        const memberId = existingUser.rows[0]?.member_id;
        const existingSinglesId = existingUser.rows[0]?.singles_id;
        await pool.query(
          `UPDATE helloworldjunktest.singles
           SET password_hash = $1,
               phone = $2,
               status = 'active'::helloworldjunktest.singles_status,
               my_refer_code = COALESCE(my_refer_code, $4),
               refer_by_code = COALESCE(refer_by_code, $5),
               updated_at = CURRENT_TIMESTAMP
           WHERE email = $3`,
          [storedData.password, formattedPhone, normalizeEmailForDb(email), referCodeFromMemberId(memberId), resolvedReferByCode]
        );
        await recordAuditRegistrationChange(pool, {
          singlesId: existingSinglesId,
          email: normalizeEmailForDb(email),
          phone: formattedPhone
        });
      } else {
        await insertNewSinglesAccount(pool, {
          emailNorm: normalizeEmailForDb(email),
          passwordHash: storedData.password,
          formattedPhone,
          referByCode: resolvedReferByCode
        });
      }

      await deletePendingVerification(email, formattedPhone);

      console.log('✅ Phone verified successfully. Account created.');
      return res.json({
        success: true,
        message: 'Phone verified successfully. Account created.'
      });
    } catch (dbError) {
      console.error('Database error in verifyPhone:', dbError);
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  } catch (error) {
    console.error('Error in verifyPhone:', error);
    res.status(500).json({ error: 'Failed to verify phone' });
  }
};

export const getSinglesPreferences_IIIIIIII = async (req, res) => {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT 
        ${sqlBooleanEnumColumnAsBool('initial_setup_done')},
        search_partner_type,
        search_partner_age_from,
        search_partner_age_to,
        search_partner_zipcode,
        theme,
        graphic
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Singles record not found' });
    }

    let row = result.rows[0];
    if (!String(row.theme ?? '').trim()) {
      const updated = await pool.query(
        `UPDATE helloworldjunktest.singles
         SET theme = $1, updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $2
         RETURNING
           ${sqlBooleanEnumColumnAsBool('initial_setup_done')},
           search_partner_type,
           search_partner_age_from,
           search_partner_age_to,
           search_partner_zipcode,
           theme,
           graphic`,
        [DEFAULT_NEW_USER_THEME, singlesId]
      );
      row = updated.rows[0] ?? { ...row, theme: DEFAULT_NEW_USER_THEME };
    }

    res.json(row);
  } catch (error) {
    console.error('Error fetching singles preferences:', error);
    res.status(500).json({ error: 'Failed to fetch singles preferences' });
  }
};

export const updateSinglesPreferences_JJJJJJJJ = async (req, res) => {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = req.body || {};
    const updates = [];
    const values = [];

    const hasAnySearchPreference =
      Object.prototype.hasOwnProperty.call(payload, 'search_partner_type') ||
      Object.prototype.hasOwnProperty.call(payload, 'search_partner_age_from') ||
      Object.prototype.hasOwnProperty.call(payload, 'search_partner_age_to') ||
      Object.prototype.hasOwnProperty.call(payload, 'search_partner_zipcode');

    const pushUpdate = (columnName, payloadKey) => {
      if (Object.prototype.hasOwnProperty.call(payload, payloadKey)) {
        values.push(payload[payloadKey] ?? null);
        updates.push(`${columnName} = $${values.length}`);
      }
    };

    pushUpdate('search_partner_type', 'search_partner_type');
    pushUpdate('search_partner_age_from', 'search_partner_age_from');
    pushUpdate('search_partner_age_to', 'search_partner_age_to');
    pushUpdate('search_partner_zipcode', 'search_partner_zipcode');
    pushUpdate('theme', 'theme');
    pushUpdate('graphic', 'graphic');

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updatable preferences were provided' });
    }

    if (hasAnySearchPreference) {
      updates.unshift(`initial_setup_done = ${sqlBooleanEnumLiteral(true)}`);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(singlesId);

    const result = await pool.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $${values.length}
       RETURNING
         ${sqlBooleanEnumColumnAsBool('initial_setup_done')},
         search_partner_type,
         search_partner_age_from,
         search_partner_age_to,
         search_partner_zipcode,
         theme,
         graphic`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Singles record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating singles preferences:', error);
    res.status(500).json({ error: 'Failed to update singles preferences' });
  }
};