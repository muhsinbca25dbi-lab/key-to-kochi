import { defineConfig } from 'vite';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash, createHmac, randomInt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { initializeApp as initAdminApp, getApps as getAdminApps, cert as adminCert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Helpers for Clean Environment Variables & Cryptographic Stateless Tokens
// ---------------------------------------------------------------------------
function cleanEnv(val) {
  if (!val) return '';
  return String(val).trim().replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK — Local Firestore Instance
// ---------------------------------------------------------------------------
let localAdminDb = null;

function getAdminDb(env) {
  if (localAdminDb) return localAdminDb;

  const projectId   = cleanEnv(env.KTK_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnv(env.KTK_FIREBASE_CLIENT_EMAIL);
  const privateKey  = cleanEnv(env.KTK_FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    const app = getAdminApps().length
      ? getAdminApps()[0]
      : initAdminApp({
          credential: adminCert({ projectId, clientEmail, privateKey }),
          projectId
        });

    localAdminDb = getAdminFirestore(app);
    return localAdminDb;
  } catch (e) {
    console.error('[KTK Local Admin SDK] Init failed:', e.message);
    return null;
  }
}

/**
 * Safely delete an individual file from ImageKit via REST API using server-side Basic Auth.
 * Returns { success: boolean, status?: number, error?: string }
 */
async function deleteImageKitFile(fileId, privateKey) {
  if (!fileId || !privateKey) return { success: false, error: 'Missing fileId or privateKey' };
  try {
    const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
    const resp = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader }
    });
    // 200, 204 or 404 (already deleted/not found) are counted as successful removals
    if (resp.ok || resp.status === 404) {
      return { success: true, status: resp.status };
    }
    const errData = await resp.json().catch(() => ({}));
    return { success: false, status: resp.status, error: errData.message || `HTTP ${resp.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sanitize and validate client property data for Firestore writes
 */
function sanitizePropertyInput(data) {
  const sanitized = {};
  if (typeof data.title === 'string' && data.title.trim()) {
    sanitized.title = data.title.trim();
  }
  if (typeof data.type === 'string' && data.type.trim()) {
    sanitized.type = data.type.trim();
  }
  if (typeof data.bhk === 'string' && data.bhk.trim()) {
    sanitized.bhk = data.bhk.trim();
  }
  if (typeof data.rent === 'number' && !isNaN(data.rent) && data.rent >= 0) {
    sanitized.rent = data.rent;
  }
  if (typeof data.deposit === 'number' && !isNaN(data.deposit) && data.deposit >= 0) {
    sanitized.deposit = data.deposit;
  }
  if (typeof data.location === 'string' && data.location.trim()) {
    sanitized.location = data.location.trim();
  }
  if (typeof data.furnishing === 'string' && data.furnishing.trim()) {
    sanitized.furnishing = data.furnishing.trim();
  }
  if (typeof data.size === 'number' && !isNaN(data.size) && data.size >= 0) {
    sanitized.size = data.size;
  }
  if (typeof data.bedrooms === 'number' && !isNaN(data.bedrooms) && data.bedrooms >= 0) {
    sanitized.bedrooms = data.bedrooms;
  }
  if (typeof data.bathrooms === 'number' && !isNaN(data.bathrooms) && data.bathrooms >= 0) {
    sanitized.bathrooms = data.bathrooms;
  }
  if (typeof data.availability === 'string' && data.availability.trim()) {
    sanitized.availability = data.availability.trim();
  }
  if (typeof data.featured === 'boolean') {
    sanitized.featured = data.featured;
  }
  if (typeof data.published === 'boolean') {
    sanitized.published = data.published;
  }
  if (typeof data.address === 'string') {
    sanitized.address = data.address.trim();
  }
  if (typeof data.description === 'string') {
    sanitized.description = data.description.trim();
  }
  if (Array.isArray(data.facilities)) {
    sanitized.facilities = data.facilities.filter(f => typeof f === 'string' && f.trim());
  }
  if (Array.isArray(data.suitableFor)) {
    sanitized.suitableFor = data.suitableFor.filter(s => typeof s === 'string' && s.trim());
  }
  if (Array.isArray(data.images)) {
    sanitized.images = data.images.filter(img => typeof img === 'string' && img.trim());
  }
  if (Array.isArray(data.imageFiles)) {
    sanitized.imageFiles = data.imageFiles.filter(f => f && typeof f === 'object' && (f.fileId || f.id || f.url));
  }
  return sanitized;
}

function getServerSecret(env) {
  const customSecret = cleanEnv(env.KTK_AUTH_SECRET);
  if (customSecret) return customSecret;
  const adminPass = cleanEnv(env.KTK_ADMIN_PASS);
  const adminEmail = cleanEnv(env.KTK_ADMIN_EMAIL).toLowerCase();
  if (adminPass || adminEmail) {
    return createHash('sha256')
      .update(`${adminPass}::${adminEmail}::ktk_production_secure_salt_2026`)
      .digest('hex');
  }
  return createHash('sha256').update('ktk_production_secure_salt_2026').digest('hex');
}

function deriveKey(secret) {
  return createHash('sha256').update(secret).digest();
}

function encryptToken(payload, secret) {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const jsonStr = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function decryptToken(tokenStr, secret) {
  try {
    if (!tokenStr || typeof tokenStr !== 'string') return null;
    const cleanStr = tokenStr.replace(/^(ktk_pat_|ktk_sess_)/, '');
    const key = deriveKey(secret);
    const buf = Buffer.from(cleanStr, 'base64url');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch (_) {
    return null;
  }
}

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
  return { ...env, ...process.env };
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
  const host = cleanEnv(env.KTK_SMTP_HOST);
  const user = cleanEnv(env.KTK_SMTP_USER);
  let pass = cleanEnv(env.KTK_SMTP_PASS);
  if (pass && pass.includes(' ')) pass = pass.replace(/\s+/g, '');

  // 1. Resend API support if configured
  if (env.RESEND_API_KEY && env.RESEND_API_KEY.trim()) {
    const fromAddr = env.RESEND_FROM || env.KTK_SMTP_FROM || 'KEY TO KOCHI <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [to],
        subject: `Your KEY TO KOCHI Admin Verification Code: ${otp}`,
        text: `Your one-time code: ${otp}\n\nExpires in 5 minutes. Do not share this code.`,
        html: `<div style="font-family:sans-serif;background:#0a0d14;padding:40px 32px;color:#f8fafc;max-width:480px;margin:auto;border-radius:12px;border:1px solid rgba(212,175,55,.3)"><h2 style="color:#d4af37;text-align:center;">KEY TO KOCHI</h2><h3 style="text-align:center;">Admin Verification Code</h3><div style="background:rgba(212,175,55,.08);border:1.5px solid rgba(212,175,55,.4);border-radius:10px;padding:24px;text-align:center;"><span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#d4af37;">${otp}</span></div><p style="color:#8492a6;font-size:11px;text-align:center;">Expires in 5 minutes.</p></div>`
      })
    });
    if (res.ok) return { ok: true, provider: 'resend' };
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Resend delivery failed: ${errData.message || res.statusText}`);
  }

  // 2. SMTP via Nodemailer
  if (host && user && pass && pass !== 'your_gmail_app_password_here' && !pass.startsWith('your_')) {
    let port = parseInt(cleanEnv(env.KTK_SMTP_PORT) || (host.includes('gmail.com') ? '465' : '587'), 10);
    let secure;
    if (cleanEnv(env.KTK_SMTP_SECURE) !== '') {
      secure = cleanEnv(env.KTK_SMTP_SECURE).toLowerCase() === 'true';
    } else {
      secure = (port === 465);
    }
    if (port === 465) secure = true;
    if (port === 587) secure = false;

    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000
    });

    await transport.sendMail({
      from: env.KTK_SMTP_FROM || `KEY TO KOCHI <${user}>`,
      to,
      subject: `Your KEY TO KOCHI Admin Verification Code: ${otp}`,
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
    return { ok: true, provider: 'smtp' };
  }

  throw new Error('Email service unconfigured. Please configure your email credentials (KTK_SMTP_USER and KTK_SMTP_PASS) in .env.');
}

function verifyAdminPass(inputPass, env) {
  const adminPass = cleanEnv(env.KTK_ADMIN_PASS);
  const adminPassHash = cleanEnv(env.KTK_ADMIN_PASS_HASH).toLowerCase();
  const rawInput = String(inputPass || '').trim();
  if (!rawInput) return false;

  if (adminPass && rawInput === adminPass) return true;
  const inputHash = createHash('sha256').update(rawInput).digest('hex').toLowerCase();
  if (adminPassHash && inputHash === adminPassHash) return true;

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
  async function handleApi(req, res, next) {
    const env = loadEnv(process.cwd());
    const ADMIN_EMAIL = cleanEnv(env.KTK_ADMIN_EMAIL).toLowerCase();
    const secret = getServerSecret(env);
    const url = req.url ? req.url.split('?')[0] : '';

    // ── Step 1: Password verification & OTP generation ────────────────────────
    if ((url === '/api/auth/login' || url === '/api/admin/login') && req.method === 'POST') {
      readBody(req).then(async body => {
        const email = cleanEnv(body.email).toLowerCase();
        const pass  = (body.password || '').trim();

        if (!ADMIN_EMAIL || email !== ADMIN_EMAIL || !verifyAdminPass(pass, env)) {
          return json(res, 401, { ok: false, error: 'Invalid email or password.' });
        }

        const otp   = genOtp();
        const salt  = genToken();
        const expiresAt = Date.now() + OTP_EXPIRY_MS;

        // Encrypted stateless token
        const token = 'ktk_pat_' + encryptToken({
          type: 'preauth',
          email,
          otp,
          expiresAt,
          attempts: 0
        }, secret);

        preAuthStore.set(token, {
          email, role: 'ADMIN',
          expiresAt,
          otpVerified: false
        });

        otpStore.set(token, {
          otpHash: hashOtp(otp, salt), salt,
          otp,
          email,
          expiresAt,
          attempts: 0, used: false
        });

        const log = sendLog.get(email) || [];
        log.push(Date.now());
        sendLog.set(email, log);

        try {
          await sendOtpEmail(env, email, otp);
          return json(res, 200, {
            ok: true,
            requiresOtp: true,
            preAuthToken: token,
            maskedEmail: maskEmail(email),
            emailSent: true,
            deliveryMethod: 'email',
            expiresInSeconds: OTP_EXPIRY_MS / 1000
          });
        } catch (err) {
          preAuthStore.delete(token);
          otpStore.delete(token);
          console.error('[KTK OTP] Send error:', err.message);
          return json(res, 503, { ok: false, error: `Failed to deliver verification code: ${err.message}` });
        }
      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Step 2: Resend OTP ──────────────────────────────────────────────────
    if (url === '/api/auth/otp/send' && req.method === 'POST') {
      readBody(req).then(async body => {
        const pat = cleanEnv(body.preAuthToken);
        const decrypted = decryptToken(pat, secret);
        const rec = preAuthStore.get(pat);

        const email = decrypted ? decrypted.email : (rec ? rec.email : null);
        if (!email) {
          return json(res, 401, { ok: false, error: 'Session expired. Please log in again.' });
        }

        const rate = checkSendRate(email);
        if (!rate.ok) return json(res, 429, { ok: false, error: rate.msg });

        const otp  = genOtp();
        const salt = genToken();
        const expiresAt = Date.now() + OTP_EXPIRY_MS;

        const newPat = 'ktk_pat_' + encryptToken({
          type: 'preauth',
          email,
          otp,
          expiresAt,
          attempts: 0
        }, secret);

        preAuthStore.set(newPat, {
          email, role: 'ADMIN',
          expiresAt,
          otpVerified: false
        });
        otpStore.set(newPat, {
          otpHash: hashOtp(otp, salt), salt,
          otp,
          email,
          expiresAt,
          attempts: 0, used: false
        });
        (sendLog.get(email) || (sendLog.set(email, []), sendLog.get(email))).push(Date.now());

        try {
          await sendOtpEmail(env, email, otp);
          return json(res, 200, {
            ok: true,
            preAuthToken: newPat,
            emailSent: true,
            deliveryMethod: 'email',
            expiresInSeconds: OTP_EXPIRY_MS / 1000
          });
        } catch(err) {
          preAuthStore.delete(newPat);
          otpStore.delete(newPat);
          return json(res, 503, { ok: false, error: `Failed to send verification code: ${err.message}` });
        }

      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Step 3: Verify OTP & issue session ──────────────────────────────────
    if (url === '/api/auth/otp/verify' && req.method === 'POST') {
      readBody(req).then(body => {
        const pat  = cleanEnv(body.preAuthToken);
        const otp  = String(body.otp || '').trim().replace(/\s/g, '');

        if (!pat || !otp) {
          return json(res, 400, { ok: false, error: 'Verification token and OTP are required.' });
        }
        if (!/^\d{6}$/.test(otp)) {
          return json(res, 400, { ok: false, error: 'Enter a valid 6-digit code.' });
        }

        let verifiedEmail = null;
        const decrypted = decryptToken(pat, secret);

        if (decrypted && decrypted.type === 'preauth') {
          if (decrypted.expiresAt < Date.now()) {
            return json(res, 401, { ok: false, error: 'Session expired. Please log in again.' });
          }
          if (decrypted.otp !== otp) {
            return json(res, 401, {
              ok: false,
              error: 'Incorrect code. Please check your email and try again.',
              attemptsLeft: 4
            });
          }
          verifiedEmail = decrypted.email;
        } else {
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

          if (hashOtp(otp, orec.salt) !== orec.otpHash && orec.otp !== otp) {
            orec.attempts++;
            const left = OTP_MAX_ATTEMPTS - orec.attempts;
            if (left <= 0) { preAuthStore.delete(pat); otpStore.delete(pat); }
            return json(res, 401, { ok: false,
              error: left > 0 ? `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} left.`
                              : 'Too many incorrect attempts. Please log in again.',
              attemptsLeft: left });
          }

          // OTP correct
          orec.used = true;
          preAuthStore.delete(pat);
          otpStore.delete(pat);
          verifiedEmail = pre.email;
        }

        const sessionToken = 'ktk_sess_' + encryptToken({
          type: 'session',
          email: verifiedEmail,
          role: 'ADMIN',
          name: 'KEY TO KOCHI Admin',
          issuedAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        }, secret);

        return json(res, 200, {
          ok: true,
          token: sessionToken,
          user: { email: verifiedEmail, role: 'ADMIN', name: 'KEY TO KOCHI Admin' }
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
      if (!token) return json(res, 401, { valid: false, error: 'Unauthorized' });

      const decrypted = decryptToken(token, secret);
      if (decrypted && decrypted.type === 'session' && decrypted.role === 'ADMIN' && decrypted.expiresAt > Date.now()) {
        return json(res, 200, {
          valid: true,
          user: { email: decrypted.email, role: 'ADMIN', name: decrypted.name || 'KEY TO KOCHI Admin' }
        });
      }

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
              KTK_SMTP_HOST: 'Your SMTP host (e.g. your-provider-host)',
              KTK_SMTP_PORT: '587',
              KTK_SMTP_USER: 'Your email address',
              KTK_SMTP_PASS: 'Your email password or App Password',
              KTK_SMTP_FROM: '"KEY TO KOCHI <admin@example.com>"'
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

    // ── Admin: Subscribers List ──────────────────────────────────────────────
    if (url === '/api/admin/subscribers' && req.method === 'GET') {
      const dataDir = join(process.cwd(), 'server', 'data');
      const subFile = join(dataDir, 'subscribers.json');
      let subscribers = [];
      try {
        if (existsSync(subFile)) {
          const list = JSON.parse(readFileSync(subFile, 'utf8'));
          if (Array.isArray(list)) subscribers = list;
        }
      } catch (e) {
        console.error('[KTK Admin Subscribers] Error:', e.message);
      }
      subscribers.sort((a, b) => new Date(b.subscribedAt || 0) - new Date(a.subscribedAt || 0));
      return json(res, 200, { ok: true, subscribers });
    }

    // ── Admin: ImageKit Upload Auth ───────────────────────────────────────────
    if (url === '/api/admin/images/auth' && req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      const privateKey = cleanEnv(env.KTK_IMAGEKIT_PRIVATE_KEY);
      const publicKey = cleanEnv(env.KTK_IMAGEKIT_PUBLIC_KEY);
      const urlEndpoint = cleanEnv(env.KTK_IMAGEKIT_URL_ENDPOINT);

      if (!privateKey || !publicKey) {
        return json(res, 503, {
          ok: false,
          error: 'ImageKit is not configured. Please set KTK_IMAGEKIT_PUBLIC_KEY, KTK_IMAGEKIT_PRIVATE_KEY, and KTK_IMAGEKIT_URL_ENDPOINT in .env file.'
        });
      }

      const uploadToken = randomBytes(16).toString('hex');
      const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      const signature = createHmac('sha1', privateKey).update(uploadToken + expire).digest('hex');

      return json(res, 200, {
        ok: true,
        token: uploadToken,
        expire,
        signature,
        publicKey,
        urlEndpoint
      });
    }

    // ── Admin: Cleanup Unsaved Uploads ────────────────────────────────────────
    if (url === '/api/admin/images/cleanup-unsaved' && req.method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      readBody(req).then(async body => {
        const fileIds = Array.isArray(body && body.fileIds)
          ? body.fileIds.filter(id => typeof id === 'string' && id.trim())
          : [];

        if (fileIds.length === 0) {
          return json(res, 200, { ok: true, cleaned: [] });
        }

        const privateKey = cleanEnv(env.KTK_IMAGEKIT_PRIVATE_KEY);
        if (privateKey) {
          const authHdr = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
          for (const fileId of fileIds) {
            try {
              await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
                method: 'DELETE',
                headers: { Authorization: authHdr }
              });
            } catch (_) {}
          }
        }
        return json(res, 200, { ok: true, cleaned: fileIds });
      }).catch(() => json(res, 400, { ok: false, error: 'Invalid request.' }));
      return;
    }

    // ── Admin: Verified Individual Image Delete ───────────────────────────────
    const imgDelMatch = url.match(/^\/api\/admin\/properties\/([^/]+)\/images\/([^/]+)$/);
    if (imgDelMatch && req.method === 'DELETE') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      const fileId = imgDelMatch[2];
      const privateKey = cleanEnv(env.KTK_IMAGEKIT_PRIVATE_KEY);
      if (privateKey) {
        try {
          const authHdr = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
          await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
            method: 'DELETE',
            headers: { Authorization: authHdr }
          });
        } catch (_) {}
      }
      return json(res, 200, { ok: true, deleted: fileId });
    }

    // ── Admin: Create Property in Firestore (POST) ───────────────────────────
    if (url === '/api/admin/properties' && req.method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      readBody(req).then(async body => {
        if (!body || typeof body !== 'object' || !body.id || typeof body.id !== 'string') {
          return json(res, 400, { ok: false, error: 'Property id is required.' });
        }

        const propId = body.id.trim();
        const isDemo = propId.startsWith('prop-') && parseInt(propId.replace('prop-', ''), 10) <= 10;
        if (isDemo) {
          return json(res, 403, { ok: false, error: 'Demo property IDs (prop-1 through prop-10) are reserved.' });
        }

        const db = getAdminDb(env);
        if (!db) {
          return json(res, 503, {
            ok: false,
            error: 'Firestore is not configured. Set KTK_FIREBASE_PROJECT_ID, KTK_FIREBASE_CLIENT_EMAIL, and KTK_FIREBASE_PRIVATE_KEY in .env file.'
          });
        }

        // Rule 2: Check whether property ID already exists in Firestore. Never overwrite an existing property.
        const existingDoc = await db.collection('properties').doc(propId).get();
        if (existingDoc.exists) {
          return json(res, 409, { ok: false, error: `Property with ID "${propId}" already exists.` });
        }

        const sanitized = sanitizePropertyInput(body);
        if (!sanitized.title) {
          return json(res, 400, { ok: false, error: 'Property title is required.' });
        }

        const newDocData = {
          id: propId,
          ...sanitized,
          createdAt: body.createdAt || new Date().toISOString(),
          _syncedAt: new Date().toISOString()
        };

        await db.collection('properties').doc(propId).set(newDocData);
        return json(res, 200, { ok: true, id: propId });
      }).catch(err => {
        console.error('[KTK Local Admin] Create property error:', err.message);
        return json(res, 500, { ok: false, error: 'Failed to create property in Firestore.' });
      });
      return;
    }

    // ── Admin: Update Property in Firestore (PUT) ────────────────────────────
    const propPutMatch = url.match(/^\/api\/admin\/properties\/([^/]+)$/);
    if (propPutMatch && req.method === 'PUT') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      const propId = propPutMatch[1].trim();

      readBody(req).then(async body => {
        if (!body || typeof body !== 'object') {
          return json(res, 400, { ok: false, error: 'Invalid update payload.' });
        }

        const db = getAdminDb(env);
        if (!db) {
          return json(res, 503, {
            ok: false,
            error: 'Firestore is not configured. Set KTK_FIREBASE_PROJECT_ID, KTK_FIREBASE_CLIENT_EMAIL, and KTK_FIREBASE_PRIVATE_KEY in .env file.'
          });
        }

        // Rule 3: Verify property exists in Firestore. Preserve immutable fields.
        const docRef = db.collection('properties').doc(propId);
        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          return json(res, 404, { ok: false, error: `Property "${propId}" not found in Firestore.` });
        }

        const existingData = existingDoc.data();
        const sanitizedUpdates = sanitizePropertyInput(body);

        const updatedDocData = {
          ...sanitizedUpdates,
          id: propId,
          createdAt: existingData.createdAt || body.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _syncedAt: new Date().toISOString()
        };

        await docRef.set(updatedDocData, { merge: true });
        return json(res, 200, { ok: true, id: propId });
      }).catch(err => {
        console.error('[KTK Local Admin] Update property error:', err.message);
        return json(res, 500, { ok: false, error: 'Failed to update property in Firestore.' });
      });
      return;
    }

    // ── Admin: Delete Property & Cascade Delete ImageKit Photos (DELETE) ─────
    const propDelMatch = url.match(/^\/api\/admin\/properties\/([^/]+)$/);
    if (propDelMatch && req.method === 'DELETE') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const session = decryptToken(token, secret);
      if (!session || session.type !== 'session' || session.role !== 'ADMIN' || session.expiresAt <= Date.now()) {
        return json(res, 401, { ok: false, error: 'Unauthorized.' });
      }

      const propId = propDelMatch[1].trim();

      // Rule 4: Guard demo properties
      const isDemo = propId.startsWith('prop-') && parseInt(propId.replace('prop-', ''), 10) <= 10;
      if (isDemo) {
        return json(res, 403, { ok: false, error: 'Demo properties (prop-1 through prop-10) are protected and cannot be deleted.' });
      }

      const db = getAdminDb(env);
      if (!db) {
        return json(res, 503, {
          ok: false,
          error: 'Firestore is not configured. Set KTK_FIREBASE_PROJECT_ID, KTK_FIREBASE_CLIENT_EMAIL, and KTK_FIREBASE_PRIVATE_KEY in .env file.'
        });
      }

      try {
        // Rule 4: Read property from Firestore
        const propDocRef = db.collection('properties').doc(propId);
        const propSnap = await propDocRef.get();
        if (!propSnap.exists) {
          return json(res, 404, { ok: false, error: `Property "${propId}" not found in Firestore.` });
        }

        const propData = propSnap.data();
        // Rule 4: Use ONLY stored imageFiles metadata from Firestore. Never trust client-supplied fileIds.
        const storedImageFiles = Array.isArray(propData.imageFiles) ? propData.imageFiles : [];
        const privateKey = cleanEnv(env.KTK_IMAGEKIT_PRIVATE_KEY);

        // Filter valid ImageKit files belonging to this property (exclude external / Unsplash URLs)
        const targetImageFiles = storedImageFiles.filter(imgFile => {
          const fileId = imgFile && (imgFile.fileId || imgFile.id);
          return (
            typeof fileId === 'string' &&
            fileId.trim().length > 0 &&
            (!imgFile.url || !imgFile.url.includes('unsplash.com'))
          );
        });

        const deletedFiles = [];
        const failedFiles = [];

        if (targetImageFiles.length > 0) {
          if (!privateKey) {
            return json(res, 503, {
              ok: false,
              error: 'ImageKit private key is not configured. Cannot safely delete property photos. Property was retained in Firestore.'
            });
          }

          for (const imgFile of targetImageFiles) {
            const fileId = imgFile.fileId || imgFile.id;
            const delRes = await deleteImageKitFile(fileId, privateKey);
            if (delRes.success) {
              deletedFiles.push(fileId);
            } else {
              failedFiles.push({ fileId, error: delRes.error || `Status ${delRes.status}` });
            }
          }
        }

        // Rule 4: If any ImageKit deletion fails, retain the Firestore property document and report the failed files clearly.
        if (failedFiles.length > 0) {
          console.warn(`[KTK Local Admin] Property "${propId}" deletion halted: ${failedFiles.length} photo(s) failed to delete.`);
          return json(res, 502, {
            ok: false,
            error: 'Failed to delete one or more property photos from ImageKit. Property document was retained in Firestore.',
            propId,
            failedImages: failedFiles,
            successfulDeletions: deletedFiles
          });
        }

        // Rule 4: Delete the Firestore document ONLY after all associated ImageKit files are successfully deleted
        await propDocRef.delete();
        return json(res, 200, { ok: true, deleted: propId, deletedImages: deletedFiles });
      } catch (err) {
        console.error('[KTK Local Admin] Delete property error:', err.message);
        return json(res, 500, { ok: false, error: 'Failed to delete property from Firestore.' });
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

