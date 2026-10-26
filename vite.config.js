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
// Send immediate property alert email to subscriber
// ---------------------------------------------------------------------------
async function sendPropertyAlertEmail(env, subscriberEmail, property, baseUrl) {
  const { KTK_SMTP_HOST: host, KTK_SMTP_PORT: port = '587',
          KTK_SMTP_USER: user, KTK_SMTP_PASS: pass,
          KTK_SMTP_FROM: from, KTK_SMTP_SECURE: secureStr } = env;

  const isRealSmtp = host && user && pass && pass !== 'your_gmail_app_password_here';
  if (!isRealSmtp) {
    throw new Error('SMTP email service is not configured. Please set KTK_SMTP_USER and KTK_SMTP_PASS in your .env file.');
  }

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10),
    secure: secureStr === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const rentFormatted = Number(property.rent || 0).toLocaleString('en-IN');
  const depositFormatted = Number(property.deposit || 0).toLocaleString('en-IN');
  const viewUrl = `${baseUrl.replace(/\/$/, '')}/?prop=${encodeURIComponent(property.id)}`;
  const unsubUrl = `${baseUrl.replace(/\/$/, '')}/api/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`;
  const coverImage = (property.images && property.images.length > 0) ? property.images[0] : '';
  const amenitiesList = (property.facilities && property.facilities.length > 0)
    ? property.facilities.join(', ')
    : 'Full premium amenities included';

  const textBody = [
    'NEW PROPERTY JUST LISTED IN KOCHI!',
    '==================================',
    '',
    `Title: ${property.title}`,
    `Location: ${property.location}${property.address ? ' (' + property.address + ')' : ''}`,
    `Monthly Rent: ₹${rentFormatted} / month`,
    `Security Deposit: ₹${depositFormatted}`,
    `Configuration: ${property.bhk || 'N/A'}`,
    `Furnishing: ${property.furnishing || 'N/A'}`,
    `Property Type: ${property.type || 'Apartment'}`,
    `Area: ${property.size ? property.size + ' sq.ft' : 'Spacious'}`,
    `Bedrooms / Bathrooms: ${property.bedrooms || 1} Bed / ${property.bathrooms || 1} Bath`,
    `Amenities: ${amenitiesList}`,
    '',
    'Description:',
    property.description || 'Verified luxury rental listing on KEY TO KOCHI.',
    '',
    'VIEW FULL DETAILS & SCHEDULE A TOUR:',
    viewUrl,
    '',
    '----------------------------------',
    'To unsubscribe from Exclusive Property Alerts:',
    unsubUrl,
    '',
    '-- KEY TO KOCHI | Luxury Rentals & Living in Kochi'
  ].join('\n');

  const facilitiesBadgesHtml = (property.facilities || []).map(f =>
    `<span style="display:inline-block;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.25);color:#d4af37;padding:4px 10px;border-radius:20px;font-size:11px;margin:3px 4px 3px 0;">✓ ${f}</span>`
  ).join('');

  const photoHtml = coverImage ? `
    <div style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid rgba(212,175,55,.25);max-height:280px;">
      <img src="${coverImage}" alt="${property.title}" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover;" />
    </div>
  ` : '';

  const htmlBody = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#06080d;padding:40px 16px;color:#f8fafc;margin:0;">
      <div style="max-width:580px;margin:auto;background:#0d111a;border-radius:16px;border:1px solid rgba(212,175,55,.3);box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden;">
        
        <!-- Header Banner -->
        <div style="padding:28px 32px;background:linear-gradient(180deg,#121824 0%,#0d111a 100%);border-bottom:1px solid rgba(212,175,55,.2);text-align:center;">
          <p style="font-size:10px;letter-spacing:3px;color:#d4af37;margin:0 0 4px;font-weight:700;">KEY TO KOCHI</p>
          <p style="font-size:11px;color:#8492a6;margin:0 0 16px;letter-spacing:1px;">LUXURY RENTALS &bull; EXCLUSIVE PROPERTY ALERT</p>
          <div style="display:inline-block;background:rgba(212,175,55,.15);border:1px solid #d4af37;color:#f6d860;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:1px;">
            🔔 NEW LISTING JUST PUBLISHED
          </div>
        </div>

        <div style="padding:32px;">
          <!-- Property Title & Location -->
          <h1 style="font-size:22px;color:#ffffff;margin:0 0 6px;line-height:1.3;font-weight:700;">${property.title}</h1>
          <p style="color:#d4af37;font-size:14px;margin:0 0 20px;font-weight:500;">
            📍 ${property.location}${property.address ? ' &bull; ' + property.address : ''}
          </p>

          ${photoHtml}

          <!-- Pricing & Core Specs Table -->
          <div style="background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(212,175,55,.15);padding-bottom:14px;margin-bottom:14px;">
              <div>
                <span style="font-size:11px;color:#8492a6;display:block;text-transform:uppercase;letter-spacing:1px;">Monthly Rent</span>
                <span style="font-size:24px;font-weight:800;color:#d4af37;">₹${rentFormatted}</span><span style="color:#8492a6;font-size:12px;"> /month</span>
              </div>
              <div style="text-align:right;">
                <span style="font-size:11px;color:#8492a6;display:block;text-transform:uppercase;letter-spacing:1px;">Deposit</span>
                <span style="font-size:16px;font-weight:600;color:#cbd5e1;">₹${depositFormatted}</span>
              </div>
            </div>

            <table style="width:100%;font-size:13px;color:#cbd5e1;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;color:#8492a6;">Configuration:</td>
                <td style="padding:6px 0;font-weight:600;color:#ffffff;text-align:right;">${property.bhk || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8492a6;">Furnishing:</td>
                <td style="padding:6px 0;font-weight:600;color:#ffffff;text-align:right;">${property.furnishing || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8492a6;">Property Type:</td>
                <td style="padding:6px 0;font-weight:600;color:#ffffff;text-align:right;">${property.type || 'Apartment'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8492a6;">Built-up Area:</td>
                <td style="padding:6px 0;font-weight:600;color:#ffffff;text-align:right;">${property.size ? property.size + ' sq.ft' : 'Spacious'}</td>
              </tr>
            </table>
          </div>

          <!-- Amenities -->
          ${property.facilities && property.facilities.length > 0 ? `
            <div style="margin-bottom:24px;">
              <p style="font-size:12px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Available Amenities</p>
              <div>${facilitiesBadgesHtml}</div>
            </div>
          ` : ''}

          <!-- View Property CTA Button -->
          <div style="text-align:center;margin:32px 0 24px;">
            <a href="${viewUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4af37 0%,#aa820a 100%);color:#07090e;font-weight:700;font-size:15px;padding:14px 36px;border-radius:30px;text-decoration:none;letter-spacing:.5px;box-shadow:0 6px 20px rgba(212,175,55,.35);">
              View Property Details &rarr;
            </a>
            <p style="color:#64748b;font-size:11px;margin:10px 0 0;">Opens live property details and tour scheduler on KEY TO KOCHI</p>
          </div>

        </div>

        <!-- Footer & Unsubscribe -->
        <div style="padding:24px 32px;background:#090c13;border-top:1px solid rgba(255,255,255,.05);text-align:center;">
          <p style="color:#64748b;font-size:11px;line-height:1.6;margin:0 0 10px;">
            You are receiving this exclusive alert because <strong style="color:#8492a6;">${subscriberEmail}</strong> is subscribed to Exclusive Property Alerts on Key to Kochi.
          </p>
          <p style="margin:0;font-size:11px;">
            <a href="${unsubUrl}" style="color:#d4af37;text-decoration:underline;">Unsubscribe from Property Alerts</a> &bull;
            <a href="${baseUrl}" style="color:#8492a6;text-decoration:none;">Visit Key to Kochi</a>
          </p>
        </div>

      </div>
    </div>
  `;

  await transport.sendMail({
    from: from || `KEY TO KOCHI <${user}>`,
    to: subscriberEmail,
    subject: 'New Property Just Listed in Kochi!',
    text: textBody,
    html: htmlBody
  });

  return true;
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

    // ── Exclusive Property Alerts — Immediate Notification Dispatch ──────────
    if (url === '/api/alerts/notify-subscribers' && req.method === 'POST') {
      readBody(req).then(async body => {
        const property = body.property;
        const baseUrl = body.baseUrl || 'http://localhost:5173';

        // 1. Never send alerts for drafts or unpublished properties
        if (!property || property.published === false) {
          return json(res, 200, {
            ok: false,
            skipped: true,
            sentCount: 0,
            message: 'Property is saved as draft or unpublished. Alerts are only sent for published listings.'
          });
        }

        if (!property.id || !property.title) {
          return json(res, 400, { ok: false, error: 'Invalid property data: ID and title are required.' });
        }

        // 2. Load registered active subscribers
        const dataDir = join(process.cwd(), 'server', 'data');
        const subFile = join(dataDir, 'subscribers.json');
        let subscribers = [];
        try {
          if (existsSync(subFile)) {
            const raw = JSON.parse(readFileSync(subFile, 'utf8'));
            if (Array.isArray(raw)) subscribers = raw;
          }
        } catch (e) {
          console.error('[KTK Alert] Failed to read subscriber list:', e.message);
        }

        const activeSubscribers = subscribers.filter(s => s && s.email && s.active !== false);

        if (activeSubscribers.length === 0) {
          return json(res, 200, {
            ok: true,
            sentCount: 0,
            totalSubscribers: 0,
            message: 'No registered subscribers found to notify.'
          });
        }

        // 3. Load alert history to prevent duplicate emails for the same property
        const historyFile = join(dataDir, 'alert_history.json');
        let alertHistory = [];
        try {
          if (existsSync(historyFile)) {
            const rawH = JSON.parse(readFileSync(historyFile, 'utf8'));
            if (Array.isArray(rawH)) alertHistory = rawH;
          }
        } catch (e) {
          console.error('[KTK Alert] Failed to read alert history:', e.message);
        }

        const alreadyNotified = new Set(
          alertHistory
            .filter(h => h.propertyId === property.id)
            .map(h => (h.email || '').toLowerCase())
        );

        const eligibleSubscribers = activeSubscribers.filter(
          s => !alreadyNotified.has(s.email.toLowerCase())
        );

        if (eligibleSubscribers.length === 0) {
          return json(res, 200, {
            ok: true,
            sentCount: 0,
            skippedCount: activeSubscribers.length,
            message: 'All registered subscribers have already received an alert for this property.'
          });
        }

        // 4. Check SMTP configuration
        const { KTK_SMTP_HOST: host, KTK_SMTP_USER: user, KTK_SMTP_PASS: pass } = env;
        const isRealSmtp = host && user && pass && pass !== 'your_gmail_app_password_here';

        if (!isRealSmtp) {
          console.warn('[KTK Alert] SMTP service not configured. Alert email delivery skipped.');
          return json(res, 200, {
            ok: false,
            notConfigured: true,
            sentCount: 0,
            error: 'SMTP email service is not configured. To send live property alerts, configure KTK_SMTP_USER and KTK_SMTP_PASS in your .env file.',
            requiredConfig: {
              KTK_SMTP_HOST: 'smtp.gmail.com (or your SMTP host)',
              KTK_SMTP_PORT: '587',
              KTK_SMTP_USER: 'Your email address',
              KTK_SMTP_PASS: 'Your 16-character Google App Password',
              KTK_SMTP_FROM: '"KEY TO KOCHI <your_email@gmail.com>"'
            }
          });
        }

        // 5. Send notifications to eligible subscribers & track confirmations
        const results = { sent: 0, failed: 0, errors: [] };
        for (const sub of eligibleSubscribers) {
          try {
            await sendPropertyAlertEmail(env, sub.email, property, baseUrl);
            results.sent++;
            alertHistory.push({
              propertyId: property.id,
              email: sub.email.toLowerCase(),
              sentAt: new Date().toISOString()
            });
            console.log(`[KTK Alert] ✅ Property alert sent to ${sub.email} for property: ${property.title}`);
          } catch (err) {
            results.failed++;
            results.errors.push({ email: sub.email, error: err.message });
            console.error(`[KTK Alert] ❌ Failed to send alert to ${sub.email}:`, err.message);
          }
        }

        // Persist history only for confirmed sent deliveries
        if (results.sent > 0) {
          try {
            if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
            writeFileSync(historyFile, JSON.stringify(alertHistory, null, 2), 'utf8');
          } catch (e) {
            console.error('[KTK Alert] Failed to persist alert history:', e.message);
          }
        }

        if (results.sent === 0 && results.failed > 0) {
          return json(res, 502, {
            ok: false,
            sentCount: 0,
            failedCount: results.failed,
            errors: results.errors,
            error: `Email delivery failed for ${results.failed} subscriber(s): ${results.errors[0]?.error || 'Unknown error'}`
          });
        }

        return json(res, 200, {
          ok: true,
          sentCount: results.sent,
          failedCount: results.failed,
          totalSubscribers: eligibleSubscribers.length,
          errors: results.errors,
          message: results.failed > 0
            ? `Property alerts sent to ${results.sent} subscriber(s); ${results.failed} failed.`
            : `Property alerts successfully sent to ${results.sent} subscriber(s).`
        });

      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request body.' }));
      return;
    }

    // ── Exclusive Property Alerts — Unsubscribe ──────────────────────────────
    if ((url === '/api/unsubscribe' || url.startsWith('/api/unsubscribe?')) && (req.method === 'GET' || req.method === 'POST')) {
      const processUnsubscribe = (rawEmail) => {
        const normEmail = (rawEmail || '').trim().toLowerCase();
        if (!normEmail) return false;

        const dataDir = join(process.cwd(), 'server', 'data');
        const subFile = join(dataDir, 'subscribers.json');
        try {
          if (existsSync(subFile)) {
            const list = JSON.parse(readFileSync(subFile, 'utf8'));
            if (Array.isArray(list)) {
              let changed = false;
              list.forEach(s => {
                if (s.email && s.email.toLowerCase() === normEmail) {
                  s.active = false;
                  s.unsubscribedAt = new Date().toISOString();
                  changed = true;
                }
              });
              if (changed) writeFileSync(subFile, JSON.stringify(list, null, 2), 'utf8');
              return true;
            }
          }
        } catch (e) {
          console.error('[KTK Unsubscribe] Error:', e.message);
        }
        return false;
      };

      if (req.method === 'GET') {
        const emailParam = (req.url.split('?')[1] ? new URLSearchParams(req.url.split('?')[1]).get('email') : '') || '';
        processUnsubscribe(emailParam);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed — KEY TO KOCHI</title>
  <style>
    body { margin: 0; background: #07090e; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
    .card { background: #0d111a; border: 1px solid rgba(212,175,55,.25); border-radius: 16px; padding: 40px 32px; max-width: 460px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,.6); }
    h1 { color: #d4af37; font-size: 22px; margin: 0 0 12px; }
    p { color: #8492a6; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
    .email-badge { color: #cbd5e1; font-weight: 600; }
    a { display: inline-block; background: rgba(212,175,55,.15); border: 1px solid #d4af37; color: #f6d860; text-decoration: none; padding: 10px 24px; border-radius: 24px; font-size: 13px; font-weight: 600; }
    a:hover { background: #d4af37; color: #07090e; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 36px; margin-bottom: 16px;">✓</div>
    <h1>You're Unsubscribed</h1>
    <p>You have been successfully removed from KEY TO KOCHI Exclusive Property Alerts.<br><span class="email-badge">${emailParam || ''}</span></p>
    <a href="/">Return to KEY TO KOCHI</a>
  </div>
</body>
</html>`);
        return;
      } else {
        readBody(req).then(body => {
          const success = processUnsubscribe(body.email);
          return json(res, 200, { ok: true, unsubscribed: success });
        }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
        return;
      }
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

