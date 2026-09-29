// Serveur push sans état (Vercel Function).
// GET  /api/push → { ok, publicKey }
// POST /api/push { subscription, items: [{ delay(ms), title, body, tag, badge }] }
//   → envoie chaque notification à l'heure prévue. Au-delà d'une tranche de ~4 min,
//     la fonction se relance elle-même avec le reste (programmations jusqu'à 60 min).
import webpush from 'web-push';

const MAX_ITEMS = 120;
const MAX_SPAN = 61 * 60 * 1000;
const SLICE = 230 * 1000;
const MAX_HOPS = 20;

let waitUntil = (p) => p;
try { ({ waitUntil } = await import('@vercel/functions')); } catch { /* hors Vercel */ }

const keys = () => ({
  pub: process.env.VAPID_PUBLIC_KEY,
  priv: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT || 'mailto:notif-sim@example.com',
});

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const str = (v, max) => String(v ?? '').slice(0, max);

function sanitize(body) {
  const sub = body && body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return null;
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS).map((i) => ({
    delay: Math.min(MAX_SPAN, Math.max(0, Number(i.delay) || 0)),
    title: str(i.title, 120),
    body: str(i.body, 400),
    tag: str(i.tag, 64),
    badge: Number.isFinite(i.badge) ? Math.max(0, Math.floor(i.badge)) : null,
  })).sort((a, b) => a.delay - b.delay);
  if (!items.length) return null;
  return {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) } },
    items,
    hop: Math.floor(Number(body.hop) || 0),
  };
}

async function run(job, selfUrl) {
  const start = Date.now();
  const now = job.items.filter((i) => i.delay < SLICE);
  const later = job.items.filter((i) => i.delay >= SLICE);
  for (const it of now) {
    const wait = start + it.delay - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      await webpush.sendNotification(job.subscription, JSON.stringify(it), { TTL: 300, urgency: 'high' });
    } catch (e) {
      // 404/410 : abonnement révoqué (annulation depuis l'app) → on arrête tout.
      if (e.statusCode === 404 || e.statusCode === 410) return;
      console.error('push error', e.statusCode, e.body);
    }
  }
  if (later.length && job.hop < MAX_HOPS && selfUrl) {
    const elapsed = Date.now() - start;
    await fetch(selfUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: job.subscription, hop: job.hop + 1, items: later.map((i) => ({ ...i, delay: Math.max(0, i.delay - elapsed) })) }),
    }).catch((e) => console.error('relay error', e));
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const { pub, priv, subject } = keys();
  if (!pub || !priv) return res.status(503).json({ ok: false, error: 'clés VAPID manquantes' });
  if (req.method === 'GET') return res.status(200).json({ ok: true, publicKey: pub, maxItems: MAX_ITEMS, maxMinutes: 60 });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'méthode non autorisée' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const job = sanitize(body);
  if (!job) return res.status(400).json({ ok: false, error: 'requête invalide' });

  webpush.setVapidDetails(subject, pub, priv);
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const selfUrl = req.headers.host ? `${proto}://${req.headers.host}/api/push` : null;
  waitUntil(run(job, selfUrl));
  return res.status(202).json({ ok: true, scheduled: job.items.length });
}
