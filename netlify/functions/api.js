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
  const subject = `Your KEY TO KOCHI Admin Verification Code: ${otp}`;
  const textContent = [
    'KEY TO KOCHI — Admin Two-Factor Authentication',
    '==============================================',
    '',
    `Your one-time 6-digit verification code is: ${otp}`,
    '',
    'This code is valid for 5 minutes and can only be used once.',
    'If you did not request this login, please change your admin password immediately.',
    '',
    '-- KEY TO KOCHI Security'
  ].join('\n');

  const htmlContent = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#07090e;padding:40px 20px;color:#f8fafc;margin:0;">
      <div style="max-width:480px;margin:auto;background:#0d111a;border:1px solid rgba(212,175,55,0.3);border-radius:16px;padding:36px;box-shadow:0 12px 35px rgba(0,0,0,0.6);text-align:center;">
        <p style="font-size:10px;letter-spacing:3px;color:#d4af37;margin:0 0 6px;font-weight:700;">KEY TO KOCHI</p>
        <h2 style="font-size:20px;color:#ffffff;margin:0 0 16px;font-weight:700;">Admin Verification Code</h2>
        <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0 0 24px;">Use the one-time code below to authenticate and access the Admin Portal.</p>
        <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:12px;padding:18px 24px;margin:0 auto 24px;display:inline-block;">
          <span style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#d4af37;">${otp}</span>
        </div>
        <p style="font-size:12px;color:#64748b;margin:0 0 8px;">⏱ Valid for <strong>5 minutes</strong> &bull; Single-use security token</p>
        <p style="font-size:11px;color:#475569;margin:16px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">If you did not attempt to sign in to KEY TO KOCHI, please ignore this email.</p>
      </div>
    </div>
  `;

  // 1. Resend HTTP API (HTTPS REST — optimal for cloud/serverless)
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
        to: [toEmail],
        subject,
        text: textContent,
        html: htmlContent
      })
    });
    const resData = await res.json().catch(() => ({}));
    if (res.ok && resData.id) {
      console.log(`[KTK Auth] ✅ OTP delivered via Resend API (ID: ${resData.id}) to ${toEmail}`);
      return { ok: true, provider: 'resend', id: resData.id };
    }
    throw new Error(`Resend API failed (${res.status}): ${resData.message || JSON.stringify(resData)}`);
  }

  // 2. SendGrid HTTP API (HTTPS REST)
  if (env.SENDGRID_API_KEY && env.SENDGRID_API_KEY.trim()) {
    const fromAddr = env.SENDGRID_FROM || env.KTK_SMTP_FROM || 'admin@keytokochi.com';
    const cleanFrom = fromAddr.replace(/^.*<|>.*$/g, '').trim() || fromAddr;
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: cleanFrom, name: 'KEY TO KOCHI' },
        subject,
        content: [
          { type: 'text/plain', value: textContent },
          { type: 'text/html', value: htmlContent }
        ]
      })
    });
    if (res.ok || res.status === 202) {
      console.log(`[KTK Auth] ✅ OTP delivered via SendGrid API to ${toEmail}`);
      return { ok: true, provider: 'sendgrid' };
    }
    const errText = await res.text().catch(() => '');
    throw new Error(`SendGrid API failed (${res.status}): ${errText}`);
  }

  // 3. Brevo HTTP API (HTTPS REST)
  if (env.BREVO_API_KEY && env.BREVO_API_KEY.trim()) {
    const fromEmail = env.BREVO_FROM || 'admin@keytokochi.com';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'KEY TO KOCHI', email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        textContent,
        htmlContent
      })
    });
    const resData = await res.json().catch(() => ({}));
    if (res.ok && resData.messageId) {
      console.log(`[KTK Auth] ✅ OTP delivered via Brevo API (ID: ${resData.messageId}) to ${toEmail}`);
      return { ok: true, provider: 'brevo', id: resData.messageId };
    }
    throw new Error(`Brevo API failed (${res.status}): ${resData.message || JSON.stringify(resData)}`);
  }

  // 4. SMTP via Nodemailer (Gmail / Custom SMTP)
  const host = env.KTK_SMTP_HOST;
  const user = env.KTK_SMTP_USER;
  const pass = env.KTK_SMTP_PASS;

  if (host && user && pass && pass !== 'your_gmail_app_password_here') {
    let port = parseInt(env.KTK_SMTP_PORT || (host.includes('gmail.com') ? '465' : '587'), 10);
    let secure = env.KTK_SMTP_SECURE !== undefined ? env.KTK_SMTP_SECURE === 'true' : (port === 465);
    const from = env.KTK_SMTP_FROM || `KEY TO KOCHI <${user}>`;

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 12000,
      greetingTimeout: 10000
    });

    const info = await transport.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[KTK Auth] ✅ OTP delivered via SMTP (${host}:${port}) to ${toEmail} (ID: ${info.messageId})`);
    return { ok: true, provider: 'smtp', messageId: info.messageId };
  }

  throw new Error('Email service unconfigured. Add your email provider credentials (such as KTK_SMTP_USER and KTK_SMTP_PASS in Netlify Environment Variables).');
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
      await sendOtpEmail(env, email, otp);
      return json(200, {
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
      console.error('[KTK Auth] Verification email failed:', err.message);
      return json(503, {
        ok: false,
        error: `Failed to deliver verification code: ${err.message}`
      });
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
      await sendOtpEmail(env, rec.email, otp);
      return json(200, {
        ok: true,
        emailSent: true,
        deliveryMethod: 'email',
        expiresInSeconds: OTP_EXPIRY_MS / 1000
      });
    } catch (err) {
      otpStore.delete(pat);
      console.error('[KTK Auth] OTP Resend failed:', err.message);
      return json(503, {
        ok: false,
        error: `Failed to send verification code: ${err.message}`
      });
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
