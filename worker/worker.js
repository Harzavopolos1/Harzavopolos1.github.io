// Site worker — shared by every site built with the site factory.
// Serves the static site (ASSETS binding) and handles two endpoints:
//   POST /api/lead  — form submission → spam check (Turnstile) → D1 (never lost) → Telegram alert
//   POST /api/hit   — cookieless page-view beacon → D1
//   POST /api/subscribe, GET /api/confirm, GET|POST /api/unsubscribe — newsletter (double opt-in)
//   GET|POST /api/mark — one-click lead status from the lead-owner's email (GET shows a confirm button, POST records it)
// Optional var LEAD_TO (+ LEAD_TO_NAME): each lead is emailed there with the mark links (the client who handles leads).
// Per-site values come from wrangler.toml [vars]: SITE (id), SITE_NAME, LANG.
// Secrets (wrangler secret put): TG_TOKEN, TG_CHAT_ID, TURNSTILE_SECRET, TEST_KEY (post-deploy self-test), RESEND_KEY (thank-you email).

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',  // HTTPS only (no includeSubDomains/preload — safe to roll back)
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

// Visit source sent by app.js: campaign tags (utm_*, gclid) + landing page + referrer. Returned as a compact JSON string.
const SRC_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'landing', 'ref'];
function parseSrc(raw) {
  if (!raw) return null;
  let o; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const k of SRC_KEYS) if (o[k]) out[k] = String(o[k]).slice(0, 200);
  return Object.keys(out).length ? JSON.stringify(out) : null;
}
const srcLabel = (s) => { try { const o = JSON.parse(s); return [o.utm_source, o.utm_medium, o.utm_campaign, o.utm_term].filter(Boolean).join(' / ') || (o.gclid ? 'google ads (gclid)' : (o.ref ? new URL(o.ref).hostname : 'direct')); } catch { return ''; } };

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function readBody(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return await request.json();
  if (ct.includes('text/plain')) { try { return JSON.parse(await request.text()); } catch { return {}; } }
  return Object.fromEntries((await request.formData()).entries());
}

async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // spam check not configured yet → accept
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || '' }),
  });
  const d = await r.json().catch(() => ({}));
  return !!d.success;
}

async function telegram(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT_ID) return false;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text, disable_web_page_preview: true }),
  });
  return r.ok;
}

// Automatic thank-you email to the person who left details (transactional, not marketing).
// Config: [vars] AUTOREPLY (JSON from site.json → autoreply) + FROM_EMAIL; secret RESEND_KEY.
async function autoreply(env, lead, leadId, isTest) {
  if (!env.RESEND_KEY || !env.FROM_EMAIL || !lead.email) return false;
  let cfg = {};
  try { cfg = JSON.parse(env.AUTOREPLY || '{}'); } catch {}
  if (cfg.enabled === false) return false;
  const he = (env.LANG || 'he') === 'he';
  const name = (lead.name || '').split(' ')[0];
  const fill = (t) => String(t || '').replaceAll('{name}', name).replaceAll('{site}', env.SITE_NAME || '');
  const subject = fill(cfg.subject || (he ? 'קיבלנו את הפנייה — {site}' : 'We got your message — {site}'));
  const text = fill(cfg.text || (he
    ? 'שלום {name},\n\nתודה על הפנייה. קיבלנו את הפרטים ונחזור אליכם בהקדם.\n\nבברכה,\n{site}'
    : 'Hi {name},\n\nThank you for reaching out. We got your details and will get back to you soon.\n\nBest,\n{site}'));
  const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<div dir="${he ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1b1b1b;max-width:560px">${esc(text).replace(/\n/g, '<br>')}</div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${env.SITE_NAME || 'Site'} <${env.FROM_EMAIL}>`, to: [lead.email],
      reply_to: env.REPLY_TO || env.FROM_EMAIL, subject: (isTest ? '[TEST] ' : '') + subject, text, html,
    }),
  });
  if (r.ok) await env.DB.prepare('UPDATE leads SET autoreplied = 1 WHERE id = ?').bind(leadId).run();
  return r.ok;
}

async function handleLead(request, env, ctx) {
  let b;
  try { b = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (b.website || b.botcheck) return json({ ok: true }); // honeypot: bots fill hidden fields
  const ip = request.headers.get('CF-Connecting-IP') || '';
  // automated post-deploy tests carry a secret header instead of passing the human check
  const isTest = !!env.TEST_KEY && request.headers.get('X-SF-Test') === env.TEST_KEY;
  if (!isTest && !(await turnstileOk(env, b['cf-turnstile-response'], ip))) return json({ ok: false, error: 'spam_check' }, 400);
  // daily form check (ads bridge): proves routing + spam gate + database without storing a lead or emailing anyone
  if (isTest && request.headers.get('X-SF-Dry') === '1') { await env.DB.prepare('SELECT 1 AS ok').first(); return json({ ok: true, dry: true }); }

  const lead = {
    name: clip(b.name, 120), phone: clip(b.phone, 40), email: clip(b.email, 200),
    message: clip(b.message, 3000), page: clip(b.page, 300),
  };
  if (!lead.phone && !lead.email) return json({ ok: false, error: 'missing_contact' }, 400);
  const source = parseSrc(b.src);
  const known = new Set(['name', 'phone', 'email', 'message', 'page', 'src', 'website', 'botcheck', 'cf-turnstile-response']);
  const extra = Object.fromEntries(Object.entries(b).filter(([k]) => !known.has(k)).slice(0, 30).map(([k, v]) => [k, clip(v, 500)]));

  // 1) store first — a lead is never lost even if Telegram is down
  const res = await env.DB.prepare(
    'INSERT INTO leads (site, created_at, name, phone, email, message, page, extra, country, source) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(env.SITE, new Date().toISOString(), isTest ? `[TEST] ${lead.name || ''}` : lead.name, lead.phone, lead.email, lead.message, lead.page,
    Object.keys(extra).length ? JSON.stringify(extra) : null, request.headers.get('CF-IPCountry'), source).run();

  // 2) alert (in the background — the visitor gets an instant answer)
  const lines = [`${isTest ? '🧪 בדיקת מערכת' : '🟢 ליד חדש'} — ${env.SITE_NAME || env.SITE}`, ''];
  if (lead.name) lines.push(`👤 ${lead.name}`);
  if (lead.phone) lines.push(`📞 ${lead.phone}`);
  if (lead.email) lines.push(`✉️ ${lead.email}`);
  for (const [k, v] of Object.entries(extra)) if (v) lines.push(`• ${k}: ${v}`);
  if (lead.message) lines.push('', `💬 ${lead.message}`);
  if (lead.page) lines.push('', `📄 ${lead.page}`);
  if (source) lines.push(`📣 ${srcLabel(source)}`);
  ctx.waitUntil(telegram(env, lines.join('\n')).then((ok) =>
    ok && env.DB.prepare('UPDATE leads SET notified = 1 WHERE id = ?').bind(res.meta.last_row_id).run()));
  ctx.waitUntil(autoreply(env, lead, res.meta.last_row_id, isTest).catch(() => false));
  ctx.waitUntil(leadOwnerMail(env, lead, res.meta.last_row_id, new URL(request.url).origin, isTest).catch(() => false));
  return json({ ok: true });
}

async function handleHit(request, env) {
  let b = {};
  try { b = await readBody(request); } catch {}
  const ua = request.headers.get('User-Agent') || '';
  if (/bot|crawler|spider|slurp|preview|headless|lighthouse|curl|wget|python/i.test(ua)) return new Response(null, { status: 204 });
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const day = new Date().toISOString().slice(0, 10);
  const visitor = await sha(`${ip}|${ua}|${day}|${env.SITE}`); // daily-rotating, never the raw IP
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  let ref = clip(b.ref, 300);
  try { if (ref && new URL(ref).hostname === new URL(request.url).hostname) ref = null; } catch {}
  const event = ['call', 'whatsapp'].includes(b.event) ? b.event : null;  // null = page view
  await env.DB.prepare('INSERT INTO hits (site, ts, path, referrer, country, device, visitor, event, source) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(env.SITE, new Date().toISOString(), clip(b.path, 300) || '/', ref, request.headers.get('CF-IPCountry'), device, visitor, event, parseSrc(b.src)).run();
  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------- lead owner: email + one-click status (added 2026-09-29)
async function hmac(env, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('lead-mark:' + (env.TEST_KEY || 'none')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}
const MARKS = {
  contacted: { he: '✅ יצרתי קשר', en: '✅ I contacted them' },
  client: { he: '🎉 נסגר — לקוח חדש', en: '🎉 Became a client' },
  not_relevant: { he: '✖️ לא רלוונטי', en: '✖️ Not relevant' },
};

async function leadOwnerMail(env, lead, id, origin, isTest) {
  if (!env.LEAD_TO) return false;
  const he = (env.LANG || 'he') === 'he', L = he ? 'he' : 'en';
  const t = await hmac(env, `${env.SITE}:${id}`);
  const link = (s) => `${origin}/api/mark?id=${id}&s=${s}&t=${t}`;
  const rows = [
    he ? `פנייה חדשה מהאתר ${env.SITE_NAME || ''}:` : `New enquiry from ${env.SITE_NAME || ''}:`, '',
    lead.name ? `${he ? 'שם' : 'Name'}: ${lead.name}` : null,
    lead.phone ? `${he ? 'טלפון' : 'Phone'}: ${lead.phone}` : null,
    lead.email ? `${he ? 'מייל' : 'Email'}: ${lead.email}` : null,
    lead.message ? `${he ? 'הודעה' : 'Message'}: ${lead.message}` : null, '',
    he ? 'אחרי שיצרתם קשר — לחיצה אחת כדי לעדכן:' : 'After you get in touch — one click to update:',
    ...Object.keys(MARKS).map((s) => `${MARKS[s][L]}: ${link(s)}`), '',
    he ? 'הפרטים נשלחו רק אליכם ולמנהל האתר. נא לא להעביר הלאה.' : 'Sent only to you and the site manager. Please do not forward.',
  ].filter((x) => x !== null);
  const subject = (isTest ? '[TEST] ' : '') + (he ? `פנייה חדשה: ${lead.name || lead.phone || ''}` : `New lead: ${lead.name || lead.phone || ''}`);
  const ok = await sendMail(env, env.LEAD_TO, subject, rows.join('\n'));
  if (ok) await env.DB.prepare('UPDATE leads SET owner_mailed = 1 WHERE id = ?').bind(id).run();
  return ok;
}

function page(env, title, body) {
  const he = (env.LANG || 'he') === 'he';
  return new Response(`<!doctype html><html lang="${he ? 'he' : 'en'}" dir="${he ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><link rel="stylesheet" href="/assets/style.css"></head><body><main class="wrap narrow" style="padding:48px 16px"><h1>${title}</h1>${body}</main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
}

async function handleMark(request, env, ctx) {
  const url = new URL(request.url), he = (env.LANG || 'he') === 'he', L = he ? 'he' : 'en';
  const id = parseInt(url.searchParams.get('id') || '0', 10), s = url.searchParams.get('s') || '', t = url.searchParams.get('t') || '';
  const bad = () => page(env, he ? 'הקישור לא תקין' : 'Invalid link', '');
  if (!id || !MARKS[s] || t !== (await hmac(env, `${env.SITE}:${id}`))) return bad();
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ? AND site = ?').bind(id, env.SITE).first();
  if (!lead) return bad();
  // GET only shows a button — mail scanners open links automatically; only a real press (POST) records anything.
  if (request.method !== 'POST') return page(env, MARKS[s][L],
    `<p>${he ? 'פנייה' : 'Lead'}: ${String(lead.name || lead.phone || id).replace(/[<>&]/g, '')}</p><form method="post"><button class="btn" type="submit">${he ? 'לאשר' : 'Confirm'}</button></form>`);
  const now = new Date().toISOString();
  if (s === 'contacted') await env.DB.prepare("UPDATE leads SET status = 'handled', contacted_at = COALESCE(contacted_at, ?) WHERE id = ?").bind(now, id).run();
  else await env.DB.prepare("UPDATE leads SET status = 'handled', contacted_at = COALESCE(contacted_at, ?), outcome = ?, outcome_at = ? WHERE id = ?").bind(now, s, now, id).run();
  ctx.waitUntil(telegram(env, `${MARKS[s].he} — ${env.SITE_NAME || env.SITE}\n👤 ${lead.name || ''} (#${id})`));
  return page(env, he ? 'עודכן, תודה!' : 'Updated, thank you!', `<p>${MARKS[s][L]}</p>`);
}

// ---------------------------------------------------------------- newsletter (double opt-in)
const T = {
  he: { cSubj: 'אישור הרשמה לעדכונים — {site}', cText: 'שלום {name},\n\nכדי להתחיל לקבל עדכונים מ{site} יש לאשר את ההרשמה בלחיצה על הקישור:\n{link}\n\nאם לא נרשמתם — אפשר פשוט להתעלם מהמייל הזה.', newSub: '📬 מנוי חדש לעדכונים' },
  en: { cSubj: 'Confirm your subscription — {site}', cText: 'Hi {name},\n\nPlease confirm you want updates from {site}:\n{link}\n\nIf you did not sign up, just ignore this email.', newSub: '📬 New newsletter subscriber' },
};
const tr = (env) => T[(env.LANG || 'he') === 'he' ? 'he' : 'en'];
const token = () => [...crypto.getRandomValues(new Uint8Array(18))].map((x) => x.toString(16).padStart(2, '0')).join('');

async function sendMail(env, to, subject, text, extraHeaders) {
  if (!env.RESEND_KEY || !env.FROM_EMAIL) return false;
  const he = (env.LANG || 'he') === 'he';
  const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<div dir="${he ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1b1b1b;max-width:560px">${esc(text).replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${env.SITE_NAME || 'Site'} <${env.FROM_EMAIL}>`, to: [to], reply_to: env.REPLY_TO || env.FROM_EMAIL, subject, text, html, headers: extraHeaders }),
  });
  return r.ok;
}

async function handleSubscribe(request, env) {
  let b;
  try { b = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (b.website || b.botcheck) return json({ ok: true });
  const isTest = !!env.TEST_KEY && request.headers.get('X-SF-Test') === env.TEST_KEY;
  if (!isTest && !(await turnstileOk(env, b['cf-turnstile-response'], request.headers.get('CF-Connecting-IP')))) return json({ ok: false, error: 'spam_check' }, 400);
  const email = clip(b.email, 200)?.toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad_email' }, 400);
  if (!b.consent) return json({ ok: false, error: 'consent' }, 400);
  const name = clip(b.name, 120);
  const row = await env.DB.prepare('SELECT * FROM subscribers WHERE site = ? AND email = ?').bind(env.SITE, email).first();
  if (row && row.status === 'active') return json({ ok: true, already: true });
  const tok = token();
  if (row) await env.DB.prepare("UPDATE subscribers SET status = 'pending', token = ?, name = COALESCE(?, name), created_at = ?, source = ? WHERE id = ?")
    .bind(tok, name, new Date().toISOString(), clip(b.page, 300), row.id).run();
  else await env.DB.prepare("INSERT INTO subscribers (site, email, name, status, token, created_at, source) VALUES (?,?,?, 'pending', ?,?,?)")
    .bind(env.SITE, email, name, tok, new Date().toISOString(), clip(b.page, 300)).run();
  const link = `${new URL(request.url).origin}/api/confirm?t=${tok}`;
  const fill = (t) => t.replaceAll('{site}', env.SITE_NAME || '').replaceAll('{name}', (name || '').split(' ')[0]).replaceAll('{link}', link);
  const sent = await sendMail(env, email, (isTest ? '[TEST] ' : '') + fill(tr(env).cSubj), fill(tr(env).cText));
  return sent ? json({ ok: true }) : json({ ok: false, error: 'mail_failed' }, 500);
}

async function handleConfirm(request, env, ctx) {
  const t = new URL(request.url).searchParams.get('t') || '';
  const row = t && await env.DB.prepare('SELECT * FROM subscribers WHERE token = ? AND site = ?').bind(t, env.SITE).first();
  if (row && row.status !== 'active') {
    await env.DB.prepare("UPDATE subscribers SET status = 'active', confirmed_at = ?, unsubscribed_at = NULL WHERE id = ?").bind(new Date().toISOString(), row.id).run();
    ctx.waitUntil(telegram(env, `${tr(env).newSub} — ${env.SITE_NAME || env.SITE}\n✉️ ${row.email}${row.name ? '\n👤 ' + row.name : ''}`));
  }
  return Response.redirect(new URL(row ? '/subscribed/' : '/', request.url).toString(), 303);
}

async function handleUnsubscribe(request, env) {
  const t = new URL(request.url).searchParams.get('t') || '';
  if (t) await env.DB.prepare("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE token = ? AND site = ?").bind(new Date().toISOString(), t, env.SITE).run();
  if (request.method === 'POST') return new Response(null, { status: 204 }); // one-click unsubscribe from mail apps
  return Response.redirect(new URL('/unsubscribed/', request.url).toString(), 303);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/lead' && request.method === 'POST') return await handleLead(request, env, ctx);
      if (url.pathname === '/api/hit' && request.method === 'POST') return await handleHit(request, env);
      if (url.pathname === '/api/subscribe' && request.method === 'POST') return await handleSubscribe(request, env);
      if (url.pathname === '/api/confirm') return await handleConfirm(request, env, ctx);
      if (url.pathname === '/api/unsubscribe') return await handleUnsubscribe(request, env);
      if (url.pathname === '/api/mark') return await handleMark(request, env, ctx);
      if (url.pathname === '/api/health') return json({ ok: true, site: env.SITE });
    } catch (e) {
      return json({ ok: false, error: 'server_error' }, 500);
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    return out;
  },
};
