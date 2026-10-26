import { defineConfig } from 'vite';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash, randomInt } from 'crypto';

// ---------------------------------------------------------------------------
// Load .env manually — server-only vars, never sent to the browser.
// ---------------------------------------------------------------------------
function loadEnv(projectRoot) {
  const envPath = join(projectRoot, '.env');
  const env = {};
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// In-memory stores (reset on server restart — acceptable for dev server OTP)
// ---------------------------------------------------------------------------
const preAuthStore = new Map(); // 'preauth:<token>' -> record
const otpStore     = new Map(); // 'otp:<token>'     -> record
const sendLog      = new Map(); // email -> [timestamps]

const OTP_EXPIRY_MS       = 5 * 60 * 1000;   // 5 min
const OTP_MAX_ATTEMPTS    = 5;
const OTP_RESEND_WAIT_MS  = 30 * 1000;        // 30 s between resends
const OTP_MAX_PER_HOUR    = 5;
const PRE_AUTH_EXPIRY_MS  = 10 * 60 * 1000;  // 10 min

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hashOtp(otp, salt) {
  return createHash('sha256').update(otp + salt).digest('hex');
}
function genOtp()   { return String(randomInt(100000, 999999)); }
function genToken() {
  return createHash('sha256')
    .update(String(Date.now()) + String(randomInt(1e9, 1e10)))
    .digest('hex').slice(0, 48);
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((ok, fail) => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch(e) { fail(e); } });
    req.on('error', fail);
  });
}
function checkSendRate(email) {
  const now = Date.now();
  const log = (sendLog.get(email) || []).filter(t => now - t < 3600000);
  sendLog.set(email, log);
  if (log.length >= OTP_MAX_PER_HOUR)
    return { ok: false, msg: 'Too many codes requested. Try again in an hour.' };
  if (log.length && now - log[log.length - 1] < OTP_RESEND_WAIT_MS) {
    const wait = Math.ceil((OTP_RESEND_WAIT_MS - (now - log[log.length - 1])) / 1000);
    return { ok: false, msg: `Wait ${wait}s before requesting a new code.` };
  }
  return { ok: true };
}
function maskEmail(e) {
  return e.replace(/^(.{2})(.*)(.{2})(@.*)$/, (_, a, b, c, d) => a + '*'.repeat(Math.max(2, b.length)) + c + d);
}

// ---------------------------------------------------------------------------
// Email via nodemailer
// ---------------------------------------------------------------------------
async function sendOtpEmail(env, to, otp) {
  const { KTK_SMTP_HOST: host, KTK_SMTP_PORT: port = '587',
          KTK_SMTP_USER: user, KTK_SMTP_PASS: pass,
          KTK_SMTP_FROM: from, KTK_SMTP_SECURE: secureStr } = env;

  const isRealSmtp = host && user && pass && pass !== 'your_gmail_app_password_here';

  if (!isRealSmtp) {
    // In local dev when SMTP credentials are not yet entered:
    // Write OTP only to a private gitignored server file for developer / test access.
    // It is NEVER exposed to network responses, browser console, or client storage.
    const { writeFileSync } = await import('fs');
    writeFileSync(join(process.cwd(), '.dev_last_otp.txt'), otp.trim(), 'utf8');
    return { ok: true, devFallback: true };
  }

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10),
    secure: secureStr === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transport.sendMail({
    from: from || `KEY TO KOCHI <${user}>`,
    to,
    subject: 'KEY TO KOCHI — Admin Verification Code',
    text: `Your one-time code: ${otp}\n\nExpires in 5 minutes. Do not share this code.`,
    html: `
<div style="font-family:sans-serif;background:#0a0d14;padding:40px 32px;color:#f8fafc;max-width:480px;margin:auto;border-radius:12px;border:1px solid rgba(212,175,55,.3)">
  <p style="text-align:center;font-size:11px;letter-spacing:3px;color:#d4af37;margin:0 0 4px">KEY TO KOCHI</p>
  <p style="text-align:center;color:#8492a6;font-size:11px;margin:0 0 28px">ADMIN PORTAL SECURITY</p>
  <h2 style="text-align:center;margin:0 0 8px;font-size:18px">Your Verification Code</h2>
  <p style="text-align:center;color:#cbd5e1;font-size:13px;margin:0 0 28px">Use this code to complete your secure admin login.</p>
  <div style="background:rgba(212,175,55,.08);border:1.5px solid rgba(212,175,55,.4);border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
    <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#d4af37">${otp}</span>
  </div>
  <p style="color:#8492a6;font-size:11px;text-align:center;margin:0">
    Expires in <strong style="color:#f59e0b">5 minutes</strong> &bull; Single use only<br>
    If you did not request this, ignore this email.
  </p>
</div>`
  });
  return { ok: true };
}

function verifyAdminPass(inputPass, env) {
  const adminPass = (env.KTK_ADMIN_PASS || '').trim();
  const adminPassHash = (env.KTK_ADMIN_PASS_HASH || '').trim();

  if (adminPass && inputPass === adminPass) return true;
  const inputHash = createHash('sha256').update(inputPass).digest('hex');
  if (adminPassHash && inputHash === adminPassHash) return true;

  // Safe default fallback hash if neither is explicitly set (sha256 of 'kochi2025'):
  if (!adminPass && !adminPassHash) {
    const defaultHash = '4c4d51cb9c1be7826372d8ffca2b73bc7ea5fc4fe2b45eb0d4de923bb6e90ff5';
    return inputHash === defaultHash;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Email helpers for subscription flow
// ---------------------------------------------------------------------------
async function sendSubscriberConfirmation(env, subscriberEmail) {
  const { KTK_SMTP_HOST: host, KTK_SMTP_PORT: port = '587',
          KTK_SMTP_USER: user, KTK_SMTP_PASS: pass,
          KTK_SMTP_FROM: from, KTK_SMTP_SECURE: secureStr } = env;

  const isRealSmtp = host && user && pass && pass !== 'your_gmail_app_password_here';
  if (!isRealSmtp) {
    console.log(`[KTK Subscribe] Dev mode - confirmation email would be sent to: ${subscriberEmail}`);
    return false;
  }

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10),
    secure: secureStr === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transport.sendMail({
    from: from || `KEY TO KOCHI <${user}>`,
    to: subscriberEmail,
    subject: 'KEY TO KOCHI - You are now subscribed to Exclusive Property Alerts',
    text: [
      'Thank you for subscribing to KEY TO KOCHI Exclusive Property Alerts!',
      '',
      'You will be among the first to know when new premium rentals are listed',
      'in Kakkanad, Marine Drive, Panampilly Nagar, and other prime Kochi locations.',
      '',
      'To unsubscribe at any time, reply to this email with the subject "Unsubscribe".',
      '',
      '-- KEY TO KOCHI | Luxury Rentals, Kochi'
    ].join('\n'),
    html: `<div style="font-family:sans-serif;background:#07090e;padding:48px 32px;color:#f8fafc;max-width:520px;margin:auto;border-radius:14px;border:1px solid rgba(212,175,55,.25)"><p style="text-align:center;font-size:11px;letter-spacing:3px;color:#d4af37;margin:0 0 2px">KEY TO KOCHI</p><p style="text-align:center;color:#8492a6;font-size:11px;margin:0 0 32px">LUXURY RENTALS &bull; KOCHI</p><h2 style="text-align:center;margin:0 0 12px;font-size:20px;font-weight:700">You&rsquo;re Subscribed!</h2><p style="text-align:center;color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 28px">You will be among the <strong style="color:#d4af37">first to know</strong> when new premium rentals are listed across Kochi&rsquo;s finest addresses &mdash; before they go public.</p><div style="background:rgba(212,175,55,.07);border:1px solid rgba(212,175,55,.2);border-radius:10px;padding:20px 24px;margin-bottom:28px"><p style="margin:0;font-size:13px;color:#8492a6;line-height:1.6"><strong style="color:#d4af37;display:block;margin-bottom:6px">What to expect:</strong>&bull; Curated new listings in prime Kochi locations<br>&bull; Early access before public announcement<br>&bull; Exclusive rental deals &amp; promotions</p></div><p style="color:#475569;font-size:11px;text-align:center;margin:0;line-height:1.6">Subscribed as <strong style="color:#8492a6">${subscriberEmail}</strong><br>To unsubscribe, reply with subject &ldquo;Unsubscribe&rdquo;.</p></div>`
  });
  return true;
}

async function sendAdminSubscriberNotification(env, subscriberEmail, totalCount, adminEmail) {
  const { KTK_SMTP_HOST: host, KTK_SMTP_PORT: port = '587',
          KTK_SMTP_USER: user, KTK_SMTP_PASS: pass,
          KTK_SMTP_SECURE: secureStr, KTK_SMTP_FROM: from } = env;

  const isRealSmtp = host && user && pass && pass !== 'your_gmail_app_password_here';
  if (!isRealSmtp) return;

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10),
    secure: secureStr === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transport.sendMail({
    from: from || `KEY TO KOCHI <${user}>`,
    to: adminEmail,
    subject: `[KEY TO KOCHI] New subscriber - ${subscriberEmail}`,
    text: `New property alert subscriber: ${subscriberEmail}\nTotal subscribers: ${totalCount}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    html: `<div style="font-family:sans-serif;background:#07090e;padding:32px;color:#f8fafc;max-width:480px;margin:auto;border-radius:12px;border:1px solid rgba(212,175,55,.2)"><p style="color:#d4af37;font-size:11px;letter-spacing:2px;margin:0 0 16px">KTK ADMIN NOTIFICATION</p><h3 style="margin:0 0 12px">New Subscriber</h3><p style="color:#cbd5e1;font-size:14px;margin:0 0 8px">Email: <strong style="color:#f6d860">${subscriberEmail}</strong></p><p style="color:#8492a6;font-size:13px;margin:0">Total subscribers: <strong style="color:#d4af37">${totalCount}</strong></p></div>`
  });
}

// ---------------------------------------------------------------------------
// Main plugin factory
// ---------------------------------------------------------------------------
export default defineConfig(() => {
  function handleApi(req, res, next) {
    const env = loadEnv(process.cwd());
    const ADMIN_EMAIL = (env.KTK_ADMIN_EMAIL || 'muhsinck19@gmail.com').trim().toLowerCase();
    const url = req.url ? req.url.split('?')[0] : '';

    // ── Step 1: Password verification & OTP generation ────────────────────────
    if ((url === '/api/auth/login' || url === '/api/admin/login') && req.method === 'POST') {
      readBody(req).then(async body => {
        const email = (body.email || '').trim().toLowerCase();
        const pass  = (body.password || '').trim();

        if (email !== ADMIN_EMAIL || !verifyAdminPass(pass, env)) {
          return json(res, 401, { ok: false, error: 'Invalid email or password.' });
        }

        const token = genToken();
        const otp   = genOtp();
        const salt  = genToken();

        preAuthStore.set(token, {
          email, role: 'ADMIN',
          expiresAt: Date.now() + PRE_AUTH_EXPIRY_MS,
          otpVerified: false
        });

        otpStore.set(token, {
          otpHash: hashOtp(otp, salt), salt,
          email,
          expiresAt: Date.now() + OTP_EXPIRY_MS,
          attempts: 0, used: false
        });

        const log = sendLog.get(email) || [];
        log.push(Date.now());
        sendLog.set(email, log);

        try {
          const sendRes = await sendOtpEmail(env, email, otp);
          const emailSent = !(sendRes && sendRes.devFallback);
          return json(res, 200, {
            ok: true,
            requiresOtp: true,
            preAuthToken: token,
            maskedEmail: maskEmail(email),
            emailSent,
            deliveryMethod: emailSent ? 'email' : 'dev_file',
            expiresInSeconds: OTP_EXPIRY_MS / 1000
          });
        } catch (err) {
          preAuthStore.delete(token);
          otpStore.delete(token);
          console.error('[KTK OTP] Send error:', err.message);
          return json(res, 503, { ok: false, error: 'Failed to send verification code. Please check SMTP settings.' });
        }
      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Step 2: Resend OTP ──────────────────────────────────────────────────
    if (url === '/api/auth/otp/send' && req.method === 'POST') {
      readBody(req).then(async body => {
        const pat = (body.preAuthToken || '').trim();
        const rec = preAuthStore.get(pat);

        if (!rec || rec.otpVerified || rec.expiresAt < Date.now()) {
          preAuthStore.delete(pat);
          return json(res, 401, { ok: false, error: 'Session expired. Please log in again.' });
        }

        const rate = checkSendRate(rec.email);
        if (!rate.ok) return json(res, 429, { ok: false, error: rate.msg });

        const otp  = genOtp();
        const salt = genToken();
        otpStore.set(pat, {
          otpHash: hashOtp(otp, salt), salt,
          email: rec.email,
          expiresAt: Date.now() + OTP_EXPIRY_MS,
          attempts: 0, used: false
        });
        (sendLog.get(rec.email) || (sendLog.set(rec.email, []), sendLog.get(rec.email))).push(Date.now());

        try {
          const sendRes = await sendOtpEmail(env, rec.email, otp);
          const emailSent = !(sendRes && sendRes.devFallback);
          return json(res, 200, {
            ok: true,
            emailSent,
            deliveryMethod: emailSent ? 'email' : 'dev_file',
            expiresInSeconds: OTP_EXPIRY_MS / 1000
          });
        } catch(err) {
          otpStore.delete(pat);
          return json(res, 503, { ok: false, error: 'Failed to send verification code. Please check SMTP settings.' });
        }

      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Step 3: Verify OTP & issue session ──────────────────────────────────
    if (url === '/api/auth/otp/verify' && req.method === 'POST') {
      readBody(req).then(body => {
        const pat  = (body.preAuthToken || '').trim();
        const otp  = (body.otp || '').trim().replace(/\s/g, '');
        const pre  = preAuthStore.get(pat);
        const orec = otpStore.get(pat);

        if (!pre || !orec)
          return json(res, 401, { ok: false, error: 'Session not found. Please log in again.' });
        if (pre.expiresAt < Date.now() || orec.expiresAt < Date.now()) {
          preAuthStore.delete(pat); otpStore.delete(pat);
          return json(res, 401, { ok: false, error: 'Session expired. Please log in again.' });
        }
        if (orec.used)
          return json(res, 401, { ok: false, error: 'Code already used. Request a new one.' });
        if (orec.attempts >= OTP_MAX_ATTEMPTS) {
          preAuthStore.delete(pat); otpStore.delete(pat);
          return json(res, 429, { ok: false, error: 'Too many incorrect attempts. Please log in again.' });
        }
        if (!/^\d{6}$/.test(otp)) {
          orec.attempts++;
          return json(res, 400, { ok: false, error: 'Enter a valid 6-digit code.',
            attemptsLeft: OTP_MAX_ATTEMPTS - orec.attempts });
        }

        if (hashOtp(otp, orec.salt) !== orec.otpHash) {
          orec.attempts++;
          const left = OTP_MAX_ATTEMPTS - orec.attempts;
          if (left <= 0) { preAuthStore.delete(pat); otpStore.delete(pat); }
          return json(res, 401, { ok: false,
            error: left > 0 ? `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} left.`
                            : 'Too many incorrect attempts. Please log in again.',
            attemptsLeft: left });
        }

        // ✅ OTP correct
        orec.used = true;
        preAuthStore.delete(pat);
        otpStore.delete(pat);

        return json(res, 200, {
          ok: true,
          token: 'ktk_sess_' + genToken(),
          user: { email: pre.email, role: 'ADMIN', name: 'KEY TO KOCHI Admin' }
        });
      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Logout ──────────────────────────────────────────────────────────────
    if (url === '/api/auth/logout') {
      return json(res, 200, { ok: true });
    }

    // ── Session verify ───────────────────────────────────────────────────────
    if (url === '/api/auth/verify') {
      const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
      if (token.startsWith('ktk_sess_'))
        return json(res, 200, { valid: true, user: { email: ADMIN_EMAIL, role: 'ADMIN', name: 'KEY TO KOCHI Admin' } });
      return json(res, 401, { valid: false, error: 'Unauthorized' });
    }

    // ── Exclusive Property Alerts — Subscribe ────────────────────────────────
    if (url === '/api/subscribe' && req.method === 'POST') {
      readBody(req).then(async body => {
        const rawEmail = (body.email || '').trim().toLowerCase();

        // 1. Validate email format
        if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          return json(res, 400, { ok: false, error: 'Please enter a valid email address.' });
        }

        // 2. Load or initialise the subscriber list
        const dataDir   = join(process.cwd(), 'server', 'data');
        const subFile   = join(dataDir, 'subscribers.json');
        let subscribers = [];
        try {
          if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
          if (existsSync(subFile)) {
            subscribers = JSON.parse(readFileSync(subFile, 'utf8'));
            if (!Array.isArray(subscribers)) subscribers = [];
          }
        } catch (e) {
          console.error('[KTK Subscribe] Failed to read subscriber list:', e.message);
          return json(res, 500, { ok: false, error: 'Internal server error. Please try again later.' });
        }

        // 3. Check for duplicate
        const alreadySubscribed = subscribers.some(s => s.email === rawEmail);
        if (alreadySubscribed) {
          return json(res, 409, { ok: false, error: 'This email is already subscribed to property alerts.' });
        }

        // 4. Save new subscriber
        const newRecord = {
          email: rawEmail,
          subscribedAt: new Date().toISOString(),
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
          active: true
        };
        subscribers.push(newRecord);
        try {
          writeFileSync(subFile, JSON.stringify(subscribers, null, 2), 'utf8');
        } catch (e) {
          console.error('[KTK Subscribe] Failed to write subscriber list:', e.message);
          return json(res, 500, { ok: false, error: 'Could not save your subscription. Please try again.' });
        }
        console.log(`[KTK Subscribe] ✅ New subscriber saved: ${rawEmail} (total: ${subscribers.length})`);

        // 5. Send confirmation email to subscriber (non-blocking — failure does not cancel subscription)
        const emailDelivered = await sendSubscriberConfirmation(env, rawEmail).catch(e => {
          console.warn('[KTK Subscribe] Confirmation email failed (subscription still saved):', e.message);
          return false;
        });

        // 6. Notify admin of new subscriber (best-effort)
        sendAdminSubscriberNotification(env, rawEmail, subscribers.length, ADMIN_EMAIL).catch(() => {});

        return json(res, 200, {
          ok: true,
          emailConfirmed: emailDelivered,
          message: emailDelivered
            ? 'You are now subscribed! Check your inbox for a confirmation.'
            : 'You are now subscribed to Exclusive Property Alerts!'
        });

      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request body.' }));
      return;
    }

    next();
  }

  return {
    plugins: [{
      name: 'ktk-auth-backend',
      configureServer(s)        { s.middlewares.use(handleApi); },
      configurePreviewServer(s) { s.middlewares.use(handleApi); }
    }]
  };
});

