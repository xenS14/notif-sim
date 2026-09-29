/* Notif Sim — simulateur de notifications de boutique en ligne (PWA iOS). */
'use strict';

/* ---------------------------------------------------------------- utilitaires */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
const uid = () => Math.random().toString(36).slice(2, 10);
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const todayKey = () => new Date().toLocaleDateString('sv-SE');

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
    localStorage.setItem(key, JSON.stringify(val));
  } catch { /* stockage indisponible : l'app fonctionne quand même */ }
  return null;
}

function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (over && typeof over === 'object') for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined || over === null ? base : over;
}

/* ---------------------------------------------------------------- modèles */
const TEMPLATES = {
  fr: {
    channel: 'Boutique en ligne',
    order: 'Vous avez une nouvelle commande de {items} d’un montant total de {amount} provenant de {channel}.',
    payout: '💸 Un versement de {payout} est en route vers votre compte bancaire.',
    customer: '{customer} vient de créer un compte client ({city}).',
    review: '{stars} Nouvel avis de {firstname} sur « {product} ».',
    stock: '⚠️ Stock faible : « {product} » — plus que {stock} en stock.',
    milestone: '🎉 Nouveau record : {count_today} commandes aujourd’hui pour {total_today} !',
    custom: 'Message personnalisé ✏️',
    names: { order: 'Nouvelle commande', payout: 'Versement', customer: 'Nouveau client', review: 'Avis client', stock: 'Stock faible', milestone: 'Record du jour', custom: 'Personnalisé' },
  },
  en: {
    channel: 'Online Store',
    order: 'You have a new order for {items} totaling {amount} from {channel}.',
    payout: '💸 A payout of {payout} is on its way to your bank account.',
    customer: '{customer} just created a customer account ({city}).',
    review: '{stars} New review from {firstname} on “{product}”.',
    stock: '⚠️ Low stock: “{product}” — only {stock} left.',
    milestone: '🎉 New record: {count_today} orders today totaling {total_today}!',
    custom: 'Custom message ✏️',
    names: { order: 'New order', payout: 'Payout', customer: 'New customer', review: 'Review', stock: 'Low stock', milestone: 'Daily record', custom: 'Custom' },
  },
};
const TYPE_META = [
  { kind: 'order', emoji: '🛍️', weight: 80, enabled: true },
  { kind: 'customer', emoji: '👤', weight: 6, enabled: true },
  { kind: 'review', emoji: '⭐️', weight: 4, enabled: true },
  { kind: 'payout', emoji: '💸', weight: 3, enabled: true },
  { kind: 'stock', emoji: '📦', weight: 3, enabled: false },
  { kind: 'milestone', emoji: '🎉', weight: 2, enabled: false },
];
const buildTypes = (lang) => TYPE_META.map((m) => ({
  id: m.kind, kind: m.kind, emoji: m.emoji, enabled: m.enabled, weight: m.weight,
  name: TEMPLATES[lang].names[m.kind], title: '{store}', body: TEMPLATES[lang][m.kind],
}));

const MONEY = [
  ['EUR:fr-FR', 'Euro — 49,90 €'], ['EUR:en-IE', 'Euro — €49.90'], ['USD:en-US', 'Dollar US — $49.90'],
  ['GBP:en-GB', 'Livre sterling — £49.90'], ['CHF:fr-CH', 'Franc suisse — 49.90 CHF'], ['CAD:fr-CA', 'Dollar canadien — 49,90 $'],
  ['MAD:fr-MA', 'Dirham — 49,90 MAD'], ['XOF:fr-FR', 'Franc CFA — 24 990 F CFA'],
];

const WALLPAPERS = {
  aurora: ['Aurore', 'radial-gradient(120% 80% at 20% 10%, #7b5cff 0%, transparent 60%), radial-gradient(100% 70% at 90% 30%, #ff5fa2 0%, transparent 55%), radial-gradient(120% 90% at 50% 100%, #18c4b4 0%, transparent 60%), #1b1640'],
  sunset: ['Coucher de soleil', 'linear-gradient(180deg, #2a1b5c 0%, #b8407a 45%, #ff8a4c 75%, #ffd27a 100%)'],
  ocean: ['Océan', 'radial-gradient(110% 70% at 70% 0%, #5ec6ff 0%, transparent 60%), linear-gradient(180deg, #0a3d91 0%, #062456 60%, #03122e 100%)'],
  money: ['Vert argent', 'radial-gradient(100% 70% at 30% 0%, #5dffa6 0%, transparent 55%), linear-gradient(180deg, #0f6b45 0%, #07351f 70%, #031a10 100%)'],
  graphite: ['Graphite', 'radial-gradient(90% 60% at 50% 0%, #4a4d55 0%, transparent 70%), linear-gradient(180deg, #23252a, #0c0d0f)'],
  peach: ['Pêche', 'radial-gradient(90% 70% at 20% 20%, #ffd3b0 0%, transparent 60%), radial-gradient(90% 70% at 90% 80%, #ff9aa8 0%, transparent 60%), #f7b39a'],
  custom: ['Ma photo', ''],
};

const DEFAULTS = {
  v: 1,
  lang: 'fr',
  store: { name: 'Ma Boutique', channel: TEMPLATES.fr.channel, money: 'EUR:fr-FR' },
  order: { next: 1001 },
  amounts: { min: 24, max: 149, psy: true, useProductPrices: true, maxItems: 3 },
  products: [
    'T-shirt Oversize | 29.90', 'Hoodie Premium | 59.90', 'Casquette Brodée | 24.90', 'Sneakers Urban | 89.90',
    'Sac Tote Bag | 19.90', 'Montre Minimal | 129.00', 'Lunettes de soleil | 39.90', 'Coque iPhone | 14.90',
  ].join('\n'),
  customers: [
    'Léa Martin', 'Hugo Bernard', 'Chloé Dubois', 'Lucas Moreau', 'Emma Laurent', 'Nathan Simon', 'Inès Michel', 'Louis Lefèvre',
    'Manon Garcia', 'Gabriel Roux', 'Camille Fournier', 'Jules Girard', 'Sarah Bonnet', 'Adam Mercier', 'Jade Lambert', 'Yanis Faure',
  ].join('\n'),
  cities: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Toulouse', 'Nice', 'Strasbourg', 'Montpellier', 'Rennes', 'Bruxelles', 'Genève'].join('\n'),
  rhythm: { pattern: 'realistic', min: 15, max: 60, burstCount: 4, stopAfter: 0, wakeLock: true },
  sound: { enabled: true, kind: 'chaching', volume: 0.8 },
  system: true,
  inapp: 'auto',
  badge: true,
  lock: { wallpaper: 'aurora', h24: true, suppressSystem: true },
  server: { url: '', count: 5, minutes: 3, firstDelay: 10 },
  types: buildTypes('fr'),
};

/* ---------------------------------------------------------------- état */
let cfg = deepMerge(clone(DEFAULTS), store('ns.cfg') || {});
let state = deepMerge({ today: { date: todayKey(), revenue: 0, orders: 0 }, history: [], badge: 0, job: null }, store('ns.state') || {});
let wallpaperData = store('ns.wall') || '';
const saveCfg = () => store('ns.cfg', cfg);
const saveState = () => store('ns.state', state);

function rollDay() {
  if (state.today.date !== todayKey()) { state.today = { date: todayKey(), revenue: 0, orders: 0 }; saveState(); }
}

const num = (path, def) => { const v = Number(getPath(cfg, path)); return Number.isFinite(v) ? v : def; };
const money = () => { const [currency, locale] = (cfg.store.money || 'EUR:fr-FR').split(':'); return { currency, locale }; };
function fmtMoney(v) {
  const { currency, locale } = money();
  try {
    const zero = ['XOF', 'JPY'].includes(currency);
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: zero ? 0 : 2, maximumFractionDigits: zero ? 0 : 2 }).format(v);
  } catch { return v.toFixed(2) + ' ' + currency; }
}
const uiLocale = () => (cfg.lang === 'en' ? 'en-US' : 'fr-FR');

/* ---------------------------------------------------------------- générateur */
function parseProducts() {
  const list = lines(cfg.products).map((l) => {
    const [name, price] = l.split('|').map((s) => s.trim());
    const p = parseFloat(String(price || '').replace(',', '.'));
    return { name, price: Number.isFinite(p) ? p : null };
  });
  return list.length ? list : [{ name: cfg.lang === 'en' ? 'Product' : 'Produit', price: null }];
}

function psyPrice(v) {
  if (!cfg.amounts.psy) return Math.round(v * 100) / 100;
  const base = Math.floor(v);
  return base + pick([0.9, 0.9, 0.99, 0.5, 0.0]);
}

function randomAmount() {
  let min = num('amounts.min', 20), max = num('amounts.max', 150);
  if (max < min) [min, max] = [max, min];
  // distribution tirée vers le bas (plus de petits paniers que de gros)
  return psyPrice(min + (max - min) * Math.pow(Math.random(), 1.6));
}

function pickItemCount() {
  const maxI = clamp(num('amounts.maxItems', 3), 1, 10);
  const w = Array.from({ length: maxI }, (_, i) => 1 / Math.pow(i + 1, 1.7));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i + 1; }
  return 1;
}

function makeOrder() {
  const products = parseProducts();
  const qty = pickItemCount();
  const chosen = Array.from({ length: qty }, () => pick(products));
  const priced = chosen.every((p) => p.price != null);
  const amount = cfg.amounts.useProductPrices && priced ? Math.round(chosen.reduce((s, p) => s + p.price, 0) * 100) / 100 : randomAmount();
  const names = [...new Set(chosen.map((p) => p.name))];
  return { qty, amount, product: chosen[0].name, products: names.join(', ') };
}

function buildVars(type) {
  rollDay();
  const customers = lines(cfg.customers);
  const customer = customers.length ? pick(customers) : 'Client';
  const o = makeOrder();
  const en = cfg.lang === 'en';
  const isOrder = type.kind === 'order';
  const orderNo = Math.max(1, Math.floor(num('order.next', 1001)));
  const countToday = state.today.orders + (isOrder ? 1 : 0);
  const totalToday = state.today.revenue + (isOrder ? o.amount : 0);
  const itemsWord = en ? (o.qty > 1 ? 'items' : 'item') : (o.qty > 1 ? 'articles' : 'article');
  return {
    vars: {
      store: cfg.store.name || 'Ma Boutique',
      channel: cfg.store.channel || TEMPLATES[cfg.lang].channel,
      order: '#' + orderNo,
      amount: fmtMoney(o.amount),
      items: `${o.qty} ${itemsWord}`,
      qty: String(o.qty),
      product: o.product,
      products: o.products,
      customer,
      firstname: customer.split(' ')[0],
      city: pick(lines(cfg.cities)) || 'Paris',
      payout: fmtMoney(state.today.revenue > 50 ? state.today.revenue * 0.971 : psyPrice(rand(num('amounts.max', 150) * 4, num('amounts.max', 150) * 18))),
      stock: String(randInt(1, 5)),
      stars: Math.random() < 0.82 ? '★★★★★' : '★★★★☆',
      count_today: String(Math.max(countToday, 1)),
      total_today: fmtMoney(Math.max(totalToday, o.amount)),
      time: new Date().toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' }),
    },
    amount: o.amount,
    isOrder,
  };
}

const render = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

function pickType() {
  const list = cfg.types.filter((t) => t.enabled && Number(t.weight) > 0);
  if (!list.length) return cfg.types[0];
  let r = Math.random() * list.reduce((s, t) => s + Number(t.weight), 0);
  for (const t of list) { r -= Number(t.weight); if (r <= 0) return t; }
  return list[0];
}

/** Crée une notification et met à jour les compteurs (n° de commande, CA). */
function generate(typeId, when = Date.now()) {
  const type = (typeId && cfg.types.find((t) => t.id === typeId)) || pickType();
  const { vars, amount, isOrder } = buildVars(type);
  if (isOrder) {
    cfg.order.next = Math.floor(num('order.next', 1001)) + 1; saveCfg();
    state.today.orders += 1; state.today.revenue = Math.round((state.today.revenue + amount) * 100) / 100;
    const inp = $('[data-k="order.next"]'); if (inp) inp.value = cfg.order.next;
  }
  if (cfg.badge) state.badge += 1;
  const n = {
    id: uid(), at: when, typeId: type.id, emoji: type.emoji || '🔔',
    title: render(type.title, vars) || vars.store, body: render(type.body, vars),
    amount: isOrder ? amount : 0, badge: cfg.badge ? state.badge : null,
  };
  state.history.unshift(n);
  state.history = state.history.slice(0, 80);
  saveState();
  return n;
}

/* ---------------------------------------------------------------- son */
let actx = null, master = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!actx) { actx = new AC(); master = actx.createGain(); master.connect(actx.destination); }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function unlockAudio() {
  const c = audio(); if (!c) return;
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
}
function tone(c, f, t, dur, gain, type = 'sine', f2) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(c, t, dur, gain, freq, q = 1, type = 'bandpass') {
  const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t);
}
function playSound(kind = cfg.sound.kind) {
  const c = audio(); if (!c) return;
  master.gain.value = clamp(num('sound.volume', 0.8), 0, 1);
  const t = c.currentTime + 0.02;
  if (kind === 'chaching') {
    // « cha » : clic mécanique de caisse
    noise(c, t, 0.07, 0.9, 2500, 0.8); tone(c, 190, t, 0.06, 0.35, 'square', 90);
    noise(c, t + 0.075, 0.05, 0.6, 3800, 1.2);
    // « ching » : cloche métallique
    const t2 = t + 0.13;
    [[2637, 0.28, 1.1], [3951, 0.16, 0.8], [5274, 0.09, 0.55], [7902, 0.05, 0.35], [3136, 0.14, 1.0]].forEach(([f, g, d]) => tone(c, f, t2, d, g));
    [[2793, 0.12, 0.9], [4186, 0.07, 0.6]].forEach(([f, g, d]) => tone(c, f, t2 + 0.045, d, g));
    noise(c, t2, 0.45, 0.12, 8000, 0.7, 'highpass');
  } else if (kind === 'ding') {
    [[1760, 0.35, 1.3], [3520, 0.12, 0.7], [5280, 0.05, 0.4]].forEach(([f, g, d]) => tone(c, f, t, d, g));
  } else if (kind === 'tritone') {
    [1318.5, 1661.2, 1975.5].forEach((f, i) => { tone(c, f, t + i * 0.12, 0.32, 0.22, 'triangle'); tone(c, f * 2, t + i * 0.12, 0.2, 0.05); });
  } else {
    tone(c, 420, t, 0.12, 0.5, 'sine', 1100);
  }
}

/* ---------------------------------------------------------------- livraison */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const notifSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
const notifGranted = () => notifSupported() && Notification.permission === 'granted';
let swReg = null;
let lockOpen = false;

async function showSystem(n) {
  if (!cfg.system || !notifGranted()) return false;
  if (lockOpen && cfg.lock.suppressSystem) return false;
  try {
    const reg = swReg || (await navigator.serviceWorker.ready);
    await reg.showNotification(n.title, { body: n.body, tag: n.id, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', data: { id: n.id } });
    return true;
  } catch (e) {
    console.warn('showNotification', e);
    return false;
  }
}

function notifEl(n, timeLabel) {
  const el = document.createElement('div');
  el.className = 'ios-notif';
  el.innerHTML = `<img src="icons/icon-96.png" alt=""><div class="c"><div class="h"><b>${esc(n.title)}</b><span data-at="${n.at}">${esc(timeLabel)}</span></div><p>${esc(n.body)}</p></div>`;
  return el;
}

function showBanner(n) {
  const box = $('#banners');
  const el = notifEl(n, cfg.lang === 'en' ? 'now' : 'maintenant');
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', close);
  let y0 = null;
  el.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', (e) => { if (y0 != null && e.touches[0].clientY - y0 < -20) { y0 = null; close(); } }, { passive: true });
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(close, 5000);
}

async function deliver(n) {
  if (cfg.sound.enabled && document.visibilityState === 'visible') playSound();
  const sys = await showSystem(n);
  if (lockOpen) addToLock(n);
  else if (document.visibilityState === 'visible' && (cfg.inapp === 'always' || (cfg.inapp === 'auto' && !sys))) showBanner(n);
  if (cfg.badge && navigator.setAppBadge) navigator.setAppBadge(state.badge).catch(() => {});
  renderStats(true);
  renderHistory();
}

async function fire(typeId) {
  const n = generate(typeId);
  await deliver(n);
  return n;
}

/* ---------------------------------------------------------------- simulation automatique */
const auto = { on: false, timer: null, sent: 0, nextAt: 0, total: 0, burstLeft: 0, wake: null };

function nextDelay() {
  let min = num('rhythm.min', 15), max = num('rhythm.max', 60);
  min = Math.max(2, min); max = Math.max(min, max);
  const p = cfg.rhythm.pattern;
  if (p === 'regular') return rand(min, max) * 1000;
  if (p === 'rush') return rand(3, 10) * 1000;
  if (p === 'burst') {
    if (auto.burstLeft > 0) { auto.burstLeft--; return rand(1.5, 4) * 1000; }
    auto.burstLeft = clamp(num('rhythm.burstCount', 4), 2, 20) - 1;
    return rand(min, max) * 1000;
  }
  // réaliste : processus de Poisson (arrivées aléatoires), borné
  const mean = (min + max) / 2;
  return clamp(-Math.log(1 - Math.random()) * mean, min, max * 2) * 1000;
}

function schedule(delay = nextDelay()) {
  clearTimeout(auto.timer);
  auto.total = delay; auto.nextAt = Date.now() + delay;
  auto.timer = setTimeout(async () => {
    if (!auto.on) return;
    await fire();
    auto.sent++;
    const stop = num('rhythm.stopAfter', 0);
    if (stop > 0 && auto.sent >= stop) { stopAuto(); toast('Simulation terminée ✅'); return; }
    schedule();
  }, delay);
  renderAuto();
}

async function keepAwake() {
  if (!auto.on || !cfg.rhythm.wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { auto.wake = await navigator.wakeLock.request('screen'); } catch { /* non supporté */ }
}

function startAuto() {
  unlockAudio();
  auto.on = true; auto.sent = 0;
  auto.burstLeft = cfg.rhythm.pattern === 'burst' ? clamp(num('rhythm.burstCount', 4), 2, 20) : 0;
  schedule(cfg.rhythm.pattern === 'rush' || cfg.rhythm.pattern === 'burst' ? 1500 : Math.min(nextDelay(), 6000));
  keepAwake();
  toast('Simulation démarrée');
}
function stopAuto() {
  auto.on = false; clearTimeout(auto.timer); auto.nextAt = 0;
  if (auto.wake) { auto.wake.release().catch(() => {}); auto.wake = null; }
  renderAuto();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  rollDay(); renderStats(); renderHistory(); renderServer();
  // iOS gèle les timers en arrière-plan : on reprend sans rattraper en rafale.
  if (auto.on) { if (auto.nextAt < Date.now()) schedule(rand(1500, 4000)); keepAwake(); }
});

/* ---------------------------------------------------------------- mode écran verrouillé (push serveur) */
const server = { checked: false, ok: false, publicKey: '', error: '' };
const serverBase = () => (cfg.server.url || '').trim().replace(/\/+$/, '') || new URL('.', location.href).href.replace(/\/$/, '');
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window;

async function checkServer() {
  server.checked = false; server.ok = false; server.error = '';
  renderServer();
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(serverBase() + '/api/push', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(to);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.publicKey) { server.ok = true; server.publicKey = j.publicKey; }
    else server.error = j.error || (r.status === 404 ? 'introuvable' : 'HTTP ' + r.status);
  } catch (e) { server.error = e.name === 'AbortError' ? 'délai dépassé' : 'injoignable'; }
  server.checked = true;
  renderServer(); renderPills();
}

const b64ToU8 = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function getSubscription() {
  const reg = swReg || (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options && sub.options.applicationServerKey;
    const want = b64ToU8(server.publicKey);
    const same = cur && new Uint8Array(cur).every((b, i) => b === want[i]) && new Uint8Array(cur).length === want.length;
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(server.publicKey) });
  return sub;
}

async function scheduleServer() {
  unlockAudio();
  if (!notifGranted()) { await askPermission(); if (!notifGranted()) return; }
  const count = clamp(Math.round(num('server.count', 5)), 1, 120);
  const minutes = clamp(num('server.minutes', 3), 0.5, 60);
  const first = clamp(num('server.firstDelay', 10), 3, 600);
  const btn = $('#btnSchedule'); if (btn) { btn.disabled = true; btn.textContent = 'Programmation…'; }
  const orderNext = cfg.order.next;
  let items = [];
  try {
    const sub = await getSubscription();
    const span = Math.max(minutes * 60 - first, 0);
    const offsets = [0, ...Array.from({ length: count - 1 }, () => Math.random() * span)].sort((a, b) => a - b);
    for (let i = 1; i < offsets.length; i++) offsets[i] = Math.max(offsets[i], offsets[i - 1] + 3);
    const now = Date.now();
    items = offsets.map((o) => {
      const delay = Math.round((first + o) * 1000);
      const n = generate(null, now + delay);
      n.sched = true;
      return { delay, title: n.title, body: n.body, tag: n.id, badge: n.badge, id: n.id, amount: n.amount };
    });
    const r = await fetch(serverBase() + '/api/push', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), items: items.map(({ amount, id, ...rest }) => rest) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
    state.job = { start: now, end: now + items[items.length - 1].delay, first: now + items[0].delay, items: items.map((i) => ({ id: i.id, at: now + i.delay, amount: i.amount })) };
    saveState();
    toast(`🔒 Verrouille ton iPhone : 1re notif dans ${Math.round(first)} s`);
  } catch (e) {
    // annule les notifications générées mais non programmées
    rollback(items);
    cfg.order.next = orderNext; saveCfg(); bindForm();
    toast('Échec de la programmation : ' + e.message);
  }
  renderServer(); renderStats(); renderHistory();
}

/** Retire des notifications programmées (non encore arrivées) de l'historique et des stats. */
function rollback(items) {
  const ids = new Set(items.map((i) => i.id));
  for (const it of items) {
    if (it.amount) { state.today.revenue = Math.max(0, Math.round((state.today.revenue - it.amount) * 100) / 100); state.today.orders = Math.max(0, state.today.orders - 1); }
    if (cfg.badge) state.badge = Math.max(0, state.badge - 1);
  }
  state.history = state.history.filter((h) => !ids.has(h.id));
  saveState();
}

async function cancelServer() {
  // Se désabonner rend l'abonnement invalide : le serveur reçoit une erreur 410 et s'arrête.
  try { const sub = await (swReg || (await navigator.serviceWorker.ready)).pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
  if (state.job) {
    const now = Date.now();
    rollback(state.job.items.filter((i) => i.at > now));
    state.job = null; saveState();
  }
  toast('Programmation annulée');
  renderServer(); renderStats(); renderHistory();
}

/* ---------------------------------------------------------------- permission */
async function askPermission() {
  unlockAudio();
  if (!notifSupported()) { toast(isIOS ? 'Installe d’abord l’app sur l’écran d’accueil' : 'Notifications non supportées ici'); return; }
  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') { toast('Notifications activées ✅'); await fire(); }
    else toast('Notifications refusées');
  } catch { toast('Impossible de demander l’autorisation'); }
  renderOnboarding(); renderPills(); renderServer();
}

/* ---------------------------------------------------------------- rendu */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function relTime(at) {
  const d = Math.round((at - Date.now()) / 1000);
  const en = cfg.lang === 'en';
  if (d > 0) return d < 60 ? (en ? `in ${d}s` : `dans ${d} s`) : (en ? `in ${Math.ceil(d / 60)} min` : `dans ${Math.ceil(d / 60)} min`);
  const a = -d;
  if (a < 45) return en ? 'now' : 'maintenant';
  if (a < 3600) return en ? `${Math.round(a / 60)}m ago` : `il y a ${Math.round(a / 60)} min`;
  return new Date(at).toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' });
}

function renderPills() {
  const p = [];
  p.push(isStandalone() ? '<span class="pill ok">Installée</span>' : '<span class="pill">Navigateur</span>');
  if (!notifSupported()) p.push('<span class="pill warn">Notifs indispo.</span>');
  else if (Notification.permission === 'granted') p.push('<span class="pill ok">Notifs ✓</span>');
  else p.push('<span class="pill warn">Notifs off</span>');
  if (server.ok) p.push('<span class="pill ok">Push ✓</span>');
  $('#statusPills').innerHTML = p.join('');
}

const SHARE_ICO = '<svg class="share-ico" viewBox="0 0 24 24"><path d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4ZM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-3v2h1v8H7v-8h1v-2Z"/></svg>';
function renderOnboarding() {
  const box = $('#onboarding');
  if (isIOS && !isStandalone()) {
    box.innerHTML = `<div class="card onb"><h2>📲 Installe l'app sur ton iPhone</h2>
      <p class="hint">iOS n'autorise les notifications que pour les apps ajoutées à l'écran d'accueil (iOS 16.4 ou plus).</p>
      <ol><li>Ouvre cette page dans <b>Safari</b></li><li>Touche <b>Partager</b> ${SHARE_ICO}</li><li>Choisis <b>« Sur l'écran d'accueil »</b> puis <b>Ajouter</b></li><li>Ouvre <b>Notif Sim</b> depuis ton écran d'accueil</li></ol>
      <p class="hint small">En attendant, tout fonctionne ici avec des bannières simulées.</p></div>`;
  } else if (notifSupported() && Notification.permission === 'default') {
    box.innerHTML = `<div class="card onb"><h2>🔔 Active les notifications</h2><p class="hint">Pour recevoir de vraies notifications iOS (écran verrouillé, centre de notifications, son).</p>
      <button class="btn primary full" style="margin:12px 0 0" id="btnPerm">Autoriser les notifications</button></div>`;
    $('#btnPerm').onclick = askPermission;
  } else if (notifSupported() && Notification.permission === 'denied') {
    box.innerHTML = `<div class="card onb"><h2>🔕 Notifications bloquées</h2><p class="hint">Va dans <b>Réglages › Notifications › Notif Sim</b> et active <b>Autoriser les notifications</b>, puis rouvre l'app.</p></div>`;
  } else box.innerHTML = '';
}

function renderStats(bump) {
  rollDay();
  const { revenue, orders } = state.today;
  const set = (id, v) => { const el = $(id); if (el.textContent !== v) { el.textContent = v; if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } };
  set('#statRevenue', fmtMoney(revenue));
  set('#statOrders', String(orders));
  set('#statAvg', orders ? fmtMoney(revenue / orders) : '—');
  $('#storeEyebrow').textContent = cfg.store.name || 'Ma Boutique';
}

function renderQuick() {
  $('#quickTypes').innerHTML = cfg.types.map((t) => `<button class="chip" data-type="${esc(t.id)}">${esc(t.emoji || '🔔')} ${esc(t.name)}</button>`).join('');
}

const PATTERN_HINT = {
  realistic: () => `Arrivées aléatoires comme une vraie boutique — en moyenne une toutes les ${Math.round((num('rhythm.min', 15) + num('rhythm.max', 60)) / 2)} s.`,
  regular: () => `Une notification toutes les ${num('rhythm.min', 15)} à ${num('rhythm.max', 60)} s.`,
  burst: () => `${num('rhythm.burstCount', 4)} notifications d'affilée, puis une pause de ${num('rhythm.min', 15)} à ${num('rhythm.max', 60)} s.`,
  rush: () => 'Grosse journée 🚀 : une notification toutes les 3 à 10 s.',
};
function renderAuto() {
  $$('#patternSeg button').forEach((b) => b.classList.toggle('active', b.dataset.p === cfg.rhythm.pattern));
  $('#patternHint').textContent = (PATTERN_HINT[cfg.rhythm.pattern] || PATTERN_HINT.realistic)();
  const btn = $('#btnAuto');
  btn.textContent = auto.on ? 'Arrêter' : 'Démarrer';
  btn.classList.toggle('stop', auto.on);
  const tag = $('#autoTag'); tag.textContent = auto.on ? 'En cours' : 'Arrêtée'; tag.classList.toggle('on', auto.on);
  $('#autoSent').textContent = auto.sent;
  const lb = $('#lockAuto'); if (lb) lb.classList.toggle('on', auto.on);
  tickAuto();
}
function tickAuto() {
  const ring = $('#cdRing');
  if (!auto.on || !auto.nextAt) { $('#cdText').textContent = '—'; $('#autoNext').textContent = '—'; ring.style.strokeDashoffset = 119.4; return; }
  const left = Math.max(0, auto.nextAt - Date.now());
  const s = Math.ceil(left / 1000);
  $('#cdText').textContent = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : s + 's';
  $('#autoNext').textContent = new Date(auto.nextAt).toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  ring.style.strokeDashoffset = 119.4 * (left / (auto.total || 1));
}

function renderHistory() {
  const ul = $('#history');
  if (!state.history.length) { ul.innerHTML = '<li class="empty">Aucune notification pour l’instant</li>'; return; }
  ul.innerHTML = state.history.slice(0, 40).map((h) => `<li><div class="em">${esc(h.emoji)}</div><div><div class="t">${esc(h.title)}</div><div class="b">${esc(h.body)}</div></div><span class="time ${h.at > Date.now() ? 'sched' : ''}">${esc(relTime(h.at))}</span></li>`).join('');
}

function renderServer() {
  const tag = $('#serverTag'), body = $('#serverBody');
  const job = state.job && state.job.end > Date.now() - 5000 ? state.job : null;
  if (!pushSupported() || (isIOS && !isStandalone())) {
    tag.textContent = 'Indisponible'; tag.classList.remove('on');
    body.innerHTML = '<p class="hint">Reçois des notifications même <b>iPhone verrouillé</b> ou app fermée. Nécessite l’app installée sur l’écran d’accueil.</p>';
    return;
  }
  if (!server.checked) { tag.textContent = 'Vérification…'; body.innerHTML = '<p class="hint">Connexion au serveur push…</p>'; return; }
  if (!server.ok) {
    tag.textContent = 'Non configuré'; tag.classList.remove('on');
    body.innerHTML = `<p class="hint">Pour recevoir des notifications <b>téléphone verrouillé</b>, il faut le petit serveur push (gratuit sur Vercel, voir README). Serveur testé : <code>${esc(serverBase())}</code> (${esc(server.error)}).</p>
      <p class="hint small">Astuce sans serveur : l’onglet <b>Aperçu</b> affiche un écran verrouillé simulé plus vrai que nature, idéal pour une capture vidéo.</p>`;
    return;
  }
  if (job) {
    tag.textContent = 'Programmé'; tag.classList.add('on');
    const now = Date.now();
    const done = job.items.filter((i) => i.at <= now).length;
    const pct = clamp(((now - job.start) / Math.max(1, job.end - job.start)) * 100, 0, 100);
    const next = job.items.find((i) => i.at > now);
    body.innerHTML = `<p class="hint"><b>${done}/${job.items.length}</b> notifications reçues. ${next ? `Prochaine ${esc(relTime(next.at))}.` : 'Terminé ✅'}</p>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <p class="hint small">Tu peux verrouiller ton iPhone ou fermer l'app 🔒</p>
      <button class="btn danger full" style="margin:12px 0 0" id="btnCancelJob">Annuler</button>`;
    $('#btnCancelJob').onclick = cancelServer;
    return;
  }
  tag.textContent = 'Prêt'; tag.classList.remove('on');
  body.innerHTML = `<p class="hint">Programme des notifications, puis <b>verrouille ton iPhone</b> : elles arriveront comme de vraies notifications.</p>
    <div class="server-grid">
      <label>Nombre<input type="number" inputmode="numeric" min="1" max="120" data-srv="count" value="${esc(num('server.count', 5))}"></label>
      <label>Sur (min)<input type="number" inputmode="decimal" min="0.5" max="60" step="0.5" data-srv="minutes" value="${esc(num('server.minutes', 3))}"></label>
      <label>1re dans (s)<input type="number" inputmode="numeric" min="3" max="600" data-srv="firstDelay" value="${esc(num('server.firstDelay', 10))}"></label>
    </div>
    <button class="btn primary full" style="margin:0" id="btnSchedule">🔒 Programmer</button>`;
  $$('[data-srv]', body).forEach((i) => i.addEventListener('input', () => { cfg.server[i.dataset.srv] = Number(i.value); saveCfg(); }));
  $('#btnSchedule').onclick = scheduleServer;
}

/* ---------- types */
const VARS = ['store', 'order', 'amount', 'items', 'product', 'products', 'customer', 'firstname', 'city', 'channel', 'payout', 'stock', 'stars', 'count_today', 'total_today', 'time', 'qty'];
function renderVars() {
  $('#varsList').innerHTML = VARS.map((v) => `<button data-var="${v}">{${v}}</button>`).join('');
}
function previewFor(t) {
  const { vars } = buildVars(t);
  return `${render(t.title, vars)} — ${render(t.body, vars)}`;
}
function renderTypes() {
  const box = $('#typesList');
  box.innerHTML = cfg.types.map((t, i) => `
    <div class="card type-card ${t.enabled ? '' : 'off'}" data-i="${i}">
      <div class="type-head">
        <button class="em" data-act="emoji" aria-label="Changer l'emoji">${esc(t.emoji || '🔔')}</button>
        <input type="text" data-f="name" value="${esc(t.name)}" aria-label="Nom du type">
        <label class="switch"><input type="checkbox" data-f="enabled" ${t.enabled ? 'checked' : ''}><i></i></label>
      </div>
      <div class="type-body form">
        <div class="weight">Fréquence <input type="range" min="0" max="100" step="1" data-f="weight" value="${Number(t.weight) || 0}"><b>${Number(t.weight) || 0}</b></div>
        <label style="margin-top:12px">Titre<input type="text" data-f="title" value="${esc(t.title)}"></label>
        <label>Message<textarea rows="3" data-f="body">${esc(t.body)}</textarea></label>
        <p class="hint small" data-prev>${esc(previewFor(t))}</p>
        <div class="type-actions">
          <button class="btn ghost small" data-act="test">Tester</button>
          ${t.kind === 'custom' ? '<button class="btn danger small" data-act="del">Supprimer</button>' : ''}
        </div>
      </div>
    </div>`).join('');
}
function onTypeInput(e) {
  const card = e.target.closest('.type-card'); if (!card) return;
  const t = cfg.types[+card.dataset.i]; const f = e.target.dataset.f; if (!f) return;
  if (f === 'enabled') { t.enabled = e.target.checked; card.classList.toggle('off', !t.enabled); }
  else if (f === 'weight') { t.weight = Number(e.target.value); e.target.nextElementSibling.textContent = t.weight; }
  else t[f] = e.target.value;
  if (f === 'title' || f === 'body') $('[data-prev]', card).textContent = previewFor(t);
  saveCfg(); renderQuick();
}
function onTypeClick(e) {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const card = btn.closest('.type-card'); const i = +card.dataset.i; const t = cfg.types[i];
  if (btn.dataset.act === 'test') { unlockAudio(); fire(t.id); }
  if (btn.dataset.act === 'del' && confirm(`Supprimer « ${t.name} » ?`)) { cfg.types.splice(i, 1); saveCfg(); renderTypes(); renderQuick(); }
  if (btn.dataset.act === 'emoji') {
    const v = prompt('Emoji pour ce type :', t.emoji || '🔔');
    if (v && v.trim()) { t.emoji = [...v.trim()].slice(0, 2).join(''); saveCfg(); renderTypes(); renderQuick(); }
  }
}
function applyTemplates(lang) {
  if (!confirm(lang === 'fr' ? 'Remplacer les textes par les modèles français ?' : 'Remplacer les textes par les modèles anglais ?')) return;
  const customs = cfg.types.filter((t) => t.kind === 'custom');
  const fresh = buildTypes(lang);
  for (const f of fresh) { const old = cfg.types.find((t) => t.id === f.id); if (old) { f.enabled = old.enabled; f.weight = old.weight; f.emoji = old.emoji; } }
  cfg.types = [...fresh, ...customs];
  cfg.lang = lang; cfg.store.channel = TEMPLATES[lang].channel;
  saveCfg(); renderTypes(); renderQuick(); bindForm(); toast('Modèles appliqués');
}

/* ---------- réglages */
function bindForm() {
  $$('#view-settings [data-k]').forEach((el) => {
    const v = getPath(cfg, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    if (el._bound) return; el._bound = true;
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number' || el.type === 'range') val = el.value === '' ? null : Number(el.value);
      else val = el.value;
      setPath(cfg, el.dataset.k, val);
      saveCfg(); onCfgChange(el.dataset.k);
    });
  });
}
function onCfgChange(k) {
  if (k.startsWith('store') || k.startsWith('amounts')) { renderStats(); }
  if (k.startsWith('rhythm')) renderAuto();
  if (k === 'lock.wallpaper') applyWallpaper();
  if (k === 'server.url') { clearTimeout(onCfgChange.t); onCfgChange.t = setTimeout(checkServer, 800); }
  if (k === 'badge' && !cfg.badge) clearBadge();
}
function clearBadge() {
  state.badge = 0; saveState();
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
}

function fillSelects() {
  $('#selCurrency').innerHTML = MONEY.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('#selWallpaper').innerHTML = Object.entries(WALLPAPERS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
}

function exportCfg() {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'notif-sim-config.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importCfg(file) {
  const r = new FileReader();
  r.onload = () => {
    try { cfg = deepMerge(clone(DEFAULTS), JSON.parse(r.result)); saveCfg(); refreshAll(); toast('Configuration importée ✅'); }
    catch { toast('Fichier invalide'); }
  };
  r.readAsText(file);
}

/* ---------- écran de verrouillage simulé */
function applyWallpaper() {
  const bg = $('#lockBg');
  const k = cfg.lock.wallpaper;
  if (k === 'custom' && wallpaperData) { bg.style.background = `center/cover no-repeat url("${wallpaperData}")`; }
  else bg.style.background = (WALLPAPERS[k] || WALLPAPERS.aurora)[1] || WALLPAPERS.aurora[1];
}
function loadWallpaper(file) {
  const img = new Image();
  img.onload = () => {
    const max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    wallpaperData = c.toDataURL('image/jpeg', 0.82);
    store('ns.wall', wallpaperData);
    cfg.lock.wallpaper = 'custom'; saveCfg(); bindForm(); applyWallpaper(); toast('Fond d’écran importé');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}
function tickClock() {
  const d = new Date();
  const loc = uiLocale();
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  if (!cfg.lock.h24) h = h % 12 || 12;
  $('#lockTime').textContent = `${h}:${m}`;
  const ds = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#lockDate').textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
  $$('#lockStack [data-at]').forEach((s) => { s.textContent = relTime(+s.dataset.at); });
}
function addToLock(n) {
  const stack = $('#lockStack');
  stack.prepend(notifEl(n, relTime(n.at)));
  while (stack.children.length > 5) stack.lastChild.remove();
}
function openLock() {
  unlockAudio();
  lockOpen = true; applyWallpaper(); tickClock();
  $('#lockStack').classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  $('#lock').hidden = false;
  $('#lockCtrl').classList.remove('hide'); $('#lockTip').classList.remove('hide');
  setTimeout(() => $('#lockTip').classList.add('hide'), 3500);
  renderAuto();
}
function closeLock() { lockOpen = false; $('#lock').hidden = true; }

/* ---------------------------------------------------------------- navigation & événements */
function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tabbar button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'types') renderTypes();
  window.scrollTo({ top: 0 });
}

function refreshAll() {
  renderPills(); renderOnboarding(); renderStats(); renderQuick(); renderAuto(); renderHistory(); renderServer(); renderVars(); bindForm(); applyWallpaper();
  if ($('#view-types').classList.contains('active')) renderTypes();
}

function wire() {
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('click', unlockAudio, { once: true });

  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.action === 'lock') openLock(); else showView(b.dataset.view);
  });
  $('#btnSend').onclick = () => fire();
  $('#quickTypes').addEventListener('click', (e) => { const c = e.target.closest('[data-type]'); if (c) fire(c.dataset.type); });
  $('#patternSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    cfg.rhythm.pattern = b.dataset.p; saveCfg(); renderAuto();
    if (auto.on) { auto.burstLeft = 0; schedule(Math.min(nextDelay(), 4000)); }
  });
  $('#btnAuto').onclick = () => (auto.on ? stopAuto() : startAuto());
  $('#btnClearHistory').onclick = () => { state.history = state.history.filter((h) => h.at > Date.now()); saveState(); renderHistory(); };

  $('#typesList').addEventListener('input', onTypeInput);
  $('#typesList').addEventListener('change', onTypeInput);
  $('#typesList').addEventListener('click', onTypeClick);
  $('#varsList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-var]'); if (!b) return;
    const txt = `{${b.dataset.var}}`;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(`${txt} copié`), () => toast(txt));
  });
  $('#btnTplFr').onclick = () => applyTemplates('fr');
  $('#btnTplEn').onclick = () => applyTemplates('en');
  $('#btnAddType').onclick = () => {
    const lang = cfg.lang;
    cfg.types.push({ id: 'c_' + uid(), kind: 'custom', emoji: '✨', enabled: true, weight: 10, name: TEMPLATES[lang].names.custom, title: '{store}', body: TEMPLATES[lang].custom });
    saveCfg(); renderTypes(); renderQuick();
    setTimeout(() => $('#typesList').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  $('#btnTestSound').onclick = () => playSound();
  $('#btnClearBadge').onclick = () => { clearBadge(); toast('Pastille remise à zéro'); };
  $('#btnRecheck').onclick = checkServer;
  $('#btnResetDay').onclick = () => { state.today = { date: todayKey(), revenue: 0, orders: 0 }; saveState(); renderStats(); toast('Stats du jour remises à zéro'); };
  $('#btnExport').onclick = exportCfg;
  $('#importFile').onchange = (e) => { if (e.target.files[0]) importCfg(e.target.files[0]); e.target.value = ''; };
  $('#wallFile').onchange = (e) => { if (e.target.files[0]) loadWallpaper(e.target.files[0]); e.target.value = ''; };
  $('#btnReset').onclick = () => {
    if (!confirm('Réinitialiser tous les réglages ? (l’historique est conservé)')) return;
    cfg = clone(DEFAULTS); saveCfg(); refreshAll(); toast('Réglages réinitialisés');
  };

  // écran verrouillé
  $('#lock').addEventListener('click', (e) => {
    if (e.target.closest('.lock-ctrl')) return;
    $('#lockCtrl').classList.toggle('hide');
  });
  $('#lockSend').onclick = () => fire();
  $('#lockAuto').onclick = () => (auto.on ? stopAuto() : startAuto());
  $('#lockClear').onclick = () => { $('#lockStack').innerHTML = ''; };
  $('#lockClose').onclick = closeLock;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'pushed') { if (cfg.sound.enabled && document.visibilityState === 'visible') playSound(); renderHistory(); renderServer(); }
    });
  }
}

async function init() {
  fillSelects();
  wire();
  refreshAll();
  setInterval(tickAuto, 250);
  setInterval(() => { if (lockOpen) tickClock(); }, 1000);
  setInterval(() => { renderHistory(); if (state.job) renderServer(); }, 15000);
  if ('serviceWorker' in navigator) {
    try { swReg = await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW', e); }
  }
  checkServer();
}
init();
