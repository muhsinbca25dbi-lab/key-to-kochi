/**
 * Netlify Serverless Function for KEY TO KOCHI Backend API
 * Handles /api/auth/*, /api/subscribe, /api/alerts/*, and /api/unsubscribe in production.
 */
import { createHash, randomInt } from 'crypto';
import nodemailer from 'nodemailer';

// In-memory token stores for serverless lifecycle
const preAuthStore = new Map();
const otpStore = new Map();
const subscribersStore = [];
const alertHistoryStore = [];

const PRE_AUTH_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_EXPIRY_MS      = 5 * 60 * 1000;  // 5 minutes
const OTP_MAX_ATTEMPTS   = 5;

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      ...extraHeaders
    },
    body: JSON.stringify(data)
  };
}

function html(statusCode, content) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: content
  };
}

function genToken() {
  return createHash('sha256').update(Date.now() + ':' + Math.random()).digest('hex');
}

function genOtp() {
  return String(randomInt(100000, 1000000));
}

function hashOtp(otp, salt) {
  return createHash('sha256').update(otp + ':' + salt).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function verifyAdminPass(password, env) {
  const adminPass = (env.KTK_ADMIN_PASS || 'kochi2025').trim();
  const adminHash = (env.KTK_ADMIN_PASS_HASH || '').trim().toLowerCase();
  const inputHash = createHash('sha256').update(password).digest('hex').toLowerCase();

  if (adminHash && inputHash === adminHash) return true;
  if (adminPass && password === adminPass) return true;
  return false;
}

async function sendOtpEmail(env, toEmail, otp) {
  const host = env.KTK_SMTP_HOST;
  const port = env.KTK_SMTP_PORT || '587';
  const user = env.KTK_SMTP_USER;
  const pass = env.KTK_SMTP_PASS;
  const from = env.KTK_SMTP_FROM || `KEY TO KOCHI <${user}>`;
  const secure = env.KTK_SMTP_SECURE === 'true';

  if (!host || !user || !pass || pass === 'your_gmail_app_password_here') {
    return { devFallback: true };
  }

  const transport = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transport.sendMail({
    from,
    to: toEmail,
    subject: `Your KEY TO KOCHI Admin Verification Code: ${otp}`,
    text: `Your one-time admin verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code.`,
    html: `<div style="font-family:sans-serif;background:#07090e;padding:40px;color:#fff;border-radius:12px;border:1px solid #d4af37;"><h2 style="color:#d4af37;">KEY TO KOCHI</h2><p>Your one-time admin verification code is:</p><h1 style="color:#d4af37;letter-spacing:6px;">${otp}</h1><p>Valid for 5 minutes.</p></div>`
  });

  return { ok: true };
}

async function sendSubscriberConfirmation(env, subscriberEmail) {
  const host = env.KTK_SMTP_HOST;
  const port = env.KTK_SMTP_PORT || '587';
  const user = env.KTK_SMTP_USER;
  const pass = env.KTK_SMTP_PASS;
  const from = env.KTK_SMTP_FROM || `KEY TO KOCHI <${user}>`;
  const secure = env.KTK_SMTP_SECURE === 'true';

  if (!host || !user || !pass || pass === 'your_gmail_app_password_here') return false;

  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10), secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transport.sendMail({
    from,
    to: subscriberEmail,
    subject: 'KEY TO KOCHI - You are now subscribed to Exclusive Property Alerts',
    text: 'Thank you for subscribing to KEY TO KOCHI Exclusive Property Alerts! You will be among the first to know when new premium rentals are listed.',
    html: `<div style="font-family:sans-serif;background:#07090e;padding:40px;color:#fff;border-radius:12px;border:1px solid #d4af37;"><h2 style="color:#d4af37;">KEY TO KOCHI</h2><h3>You're Subscribed!</h3><p>You will receive priority access to new rental properties in Kochi.</p></div>`
  });
  return true;
}

async function sendPropertyAlertEmail(env, subscriberEmail, property, baseUrl) {
  const host = env.KTK_SMTP_HOST;
  const port = env.KTK_SMTP_PORT || '587';
  const user = env.KTK_SMTP_USER;
  const pass = env.KTK_SMTP_PASS;
  const from = env.KTK_SMTP_FROM || `KEY TO KOCHI <${user}>`;
  const secure = env.KTK_SMTP_SECURE === 'true';

  if (!host || !user || !pass || pass === 'your_gmail_app_password_here') {
    throw new Error('SMTP email service is not configured. Please set KTK_SMTP_USER and KTK_SMTP_PASS in environment variables.');
  }

  const transport = nodemailer.createTransport({
    host, port: parseInt(port, 10), secure,
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
    `Deposit: ₹${depositFormatted}`,
    `Configuration: ${property.bhk || 'N/A'}`,
    `Furnishing: ${property.furnishing || 'N/A'}`,
    `Area: ${property.size ? property.size + ' sq.ft' : 'Spacious'}`,
    `Amenities: ${amenitiesList}`,
    '',
    'VIEW FULL DETAILS & SCHEDULE A TOUR:',
    viewUrl,
    '',
    'To unsubscribe:',
    unsubUrl
  ].join('\n');

  const photoHtml = coverImage ? `
    <div style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid rgba(212,175,55,.25);max-height:280px;">
      <img src="${coverImage}" alt="${property.title}" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover;" />
    </div>
  ` : '';

  const htmlBody = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#06080d;padding:40px 16px;color:#f8fafc;margin:0;">
      <div style="max-width:580px;margin:auto;background:#0d111a;border-radius:16px;border:1px solid rgba(212,175,55,.3);overflow:hidden;">
        <div style="padding:28px 32px;background:#121824;border-bottom:1px solid rgba(212,175,55,.2);text-align:center;">
          <p style="font-size:10px;letter-spacing:3px;color:#d4af37;margin:0 0 4px;font-weight:700;">KEY TO KOCHI</p>
          <p style="font-size:11px;color:#8492a6;margin:0 0 16px;letter-spacing:1px;">LUXURY RENTALS &bull; EXCLUSIVE PROPERTY ALERT</p>
          <div style="display:inline-block;background:rgba(212,175,55,.15);border:1px solid #d4af37;color:#f6d860;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;">
            🔔 NEW LISTING JUST PUBLISHED
          </div>
        </div>
        <div style="padding:32px;">
          <h1 style="font-size:22px;color:#ffffff;margin:0 0 6px;">${property.title}</h1>
          <p style="color:#d4af37;font-size:14px;margin:0 0 20px;">📍 ${property.location}</p>
          ${photoHtml}
          <div style="background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="font-size:24px;font-weight:800;color:#d4af37;margin:0 0 8px;">₹${rentFormatted} <span style="font-size:13px;color:#8492a6;">/month</span></p>
            <p style="color:#cbd5e1;font-size:13px;margin:0;">${property.bhk} &bull; ${property.furnishing} &bull; ${property.type || 'Apartment'}</p>
          </div>
          <div style="text-align:center;margin:32px 0 24px;">
            <a href="${viewUrl}" style="display:inline-block;background:#d4af37;color:#07090e;font-weight:700;font-size:15px;padding:14px 36px;border-radius:30px;text-decoration:none;">View Property Details &rarr;</a>
          </div>
        </div>
        <div style="padding:20px 32px;background:#090c13;border-top:1px solid rgba(255,255,255,.05);text-align:center;">
          <p style="color:#64748b;font-size:11px;margin:0;">
            Subscribed as <strong style="color:#8492a6;">${subscriberEmail}</strong> &bull;
            <a href="${unsubUrl}" style="color:#d4af37;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </div>
  `;

  await transport.sendMail({
    from,
    to: subscriberEmail,
    subject: 'New Property Just Listed in Kochi!',
    text: textBody,
    html: htmlBody
  });

  return true;
}

export const handler = async (event) => {
  const env = process.env;
  const ADMIN_EMAIL = (env.KTK_ADMIN_EMAIL || 'muhsinck19@gmail.com').trim().toLowerCase();
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (_) {
      body = {};
    }
  }

  // 1. /api/auth/login
  if ((path === '/auth/login' || path === '/admin/login') && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const pass = (body.password || '').trim();

    if (email !== ADMIN_EMAIL || !verifyAdminPass(pass, env)) {
      return json(401, { ok: false, error: 'Invalid email or password.' });
    }

    const token = genToken();
    const otp = genOtp();
    const salt = genToken();

    preAuthStore.set(token, {
      email, role: 'ADMIN',
      expiresAt: Date.now() + PRE_AUTH_EXPIRY_MS
    });

    otpStore.set(token, {
      otpHash: hashOtp(otp, salt), salt,
      email,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0
    });

    try {
      const sendRes = await sendOtpEmail(env, email, otp);
      const emailSent = !(sendRes && sendRes.devFallback);
      return json(200, {
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
      return json(503, { ok: false, error: 'Failed to send verification code. Check SMTP settings.' });
    }
  }

  // 2. /api/auth/otp/send (resend)
  if (path === '/auth/otp/send' && method === 'POST') {
    const pat = (body.preAuthToken || '').trim();
    const rec = preAuthStore.get(pat);

    if (!rec || rec.expiresAt < Date.now()) {
      return json(401, { ok: false, error: 'Session expired. Please log in again.' });
    }

    const otp = genOtp();
    const salt = genToken();
    otpStore.set(pat, {
      otpHash: hashOtp(otp, salt), salt,
      email: rec.email,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0
    });

    try {
      const sendRes = await sendOtpEmail(env, rec.email, otp);
      return json(200, {
        ok: true,
        emailSent: !(sendRes && sendRes.devFallback),
        expiresInSeconds: OTP_EXPIRY_MS / 1000
      });
    } catch (err) {
      return json(503, { ok: false, error: 'Failed to send verification code.' });
    }
  }

  // 3. /api/auth/otp/verify
  if (path === '/auth/otp/verify' && method === 'POST') {
    const pat = (body.preAuthToken || '').trim();
    const otp = (body.otp || '').trim().replace(/\s/g, '');
    const pre = preAuthStore.get(pat);
    const orec = otpStore.get(pat);

    if (!pre || !orec || pre.expiresAt < Date.now() || orec.expiresAt < Date.now()) {
      return json(401, { ok: false, error: 'Session expired. Please log in again.' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return json(400, { ok: false, error: 'Enter a valid 6-digit code.' });
    }

    if (hashOtp(otp, orec.salt) !== orec.otpHash) {
      orec.attempts = (orec.attempts || 0) + 1;
      const left = OTP_MAX_ATTEMPTS - orec.attempts;
      return json(401, {
        ok: false,
        error: left > 0 ? `Incorrect code. ${left} attempts left.` : 'Too many incorrect attempts.',
        attemptsLeft: Math.max(0, left)
      });
    }

    preAuthStore.delete(pat);
    otpStore.delete(pat);

    return json(200, {
      ok: true,
      token: 'ktk_sess_' + genToken(),
      user: { email: pre.email, role: 'ADMIN', name: 'KEY TO KOCHI Admin' }
    });
  }

  // 4. /api/auth/logout
  if (path === '/auth/logout') {
    return json(200, { ok: true });
  }

  // 5. /api/subscribe
  if (path === '/subscribe' && method === 'POST') {
    const rawEmail = (body.email || '').trim().toLowerCase();
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return json(400, { ok: false, error: 'Please enter a valid email address.' });
    }

    const exists = subscribersStore.some(s => s.email === rawEmail);
    if (exists) {
      return json(409, { ok: false, error: 'This email is already subscribed to property alerts.' });
    }

    subscribersStore.push({
      email: rawEmail,
      subscribedAt: new Date().toISOString(),
      active: true
    });

    const emailDelivered = await sendSubscriberConfirmation(env, rawEmail).catch(() => false);

    return json(200, {
      ok: true,
      emailConfirmed: emailDelivered,
      message: 'You are now subscribed to Exclusive Property Alerts!'
    });
  }

  // 6. /api/alerts/notify-subscribers
  if (path === '/alerts/notify-subscribers' && method === 'POST') {
    const property = body.property;
    const baseUrl = body.baseUrl || 'https://keytokochi.netlify.app';

    if (!property || property.published === false) {
      return json(200, {
        ok: false,
        skipped: true,
        sentCount: 0,
        message: 'Property is saved as draft or unpublished. Alerts are only sent for published listings.'
      });
    }

    const activeSubscribers = subscribersStore.filter(s => s.active !== false);
    if (activeSubscribers.length === 0) {
      return json(200, {
        ok: true,
        sentCount: 0,
        message: 'No registered subscribers found to notify.'
      });
    }

    const alreadyNotified = new Set(
      alertHistoryStore
        .filter(h => h.propertyId === property.id)
        .map(h => h.email)
    );

    const eligible = activeSubscribers.filter(s => !alreadyNotified.has(s.email));
    if (eligible.length === 0) {
      return json(200, {
        ok: true,
        sentCount: 0,
        message: 'All registered subscribers have already received an alert for this property.'
      });
    }

    const { KTK_SMTP_HOST: host, KTK_SMTP_USER: user, KTK_SMTP_PASS: pass } = env;
    if (!host || !user || !pass || pass === 'your_gmail_app_password_here') {
      return json(200, {
        ok: false,
        notConfigured: true,
        sentCount: 0,
        error: 'SMTP email service is not configured on Netlify environment variables.'
      });
    }

    let sent = 0;
    const errors = [];
    for (const sub of eligible) {
      try {
        await sendPropertyAlertEmail(env, sub.email, property, baseUrl);
        sent++;
        alertHistoryStore.push({ propertyId: property.id, email: sub.email });
      } catch (e) {
        errors.push({ email: sub.email, error: e.message });
      }
    }

    return json(200, {
      ok: true,
      sentCount: sent,
      failedCount: errors.length,
      errors
    });
  }

  // 7. /api/unsubscribe
  if (path === '/unsubscribe') {
    const queryEmail = event.queryStringParameters?.email || body?.email || '';
    const norm = queryEmail.trim().toLowerCase();
    const item = subscribersStore.find(s => s.email === norm);
    if (item) item.active = false;

    if (method === 'GET') {
      return html(200, `<!DOCTYPE html><html><body style="background:#07090e;color:#fff;font-family:sans-serif;text-align:center;padding:50px;"><h2 style="color:#d4af37;">You have been unsubscribed</h2><p>You will no longer receive property alert emails for ${norm}.</p><a href="/" style="color:#d4af37;">Return to KEY TO KOCHI</a></body></html>`);
    }
    return json(200, { ok: true, unsubscribed: true });
  }

  return json(404, { error: 'Not Found', path });
};
