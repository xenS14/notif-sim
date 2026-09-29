// Crée (une seule fois) les clés VAPID dans .env.local — ce fichier n'est jamais commité.
import webpush from 'web-push';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = new URL('../.env.local', import.meta.url);

export function ensureVapid() {
  const env = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
  if (get('VAPID_PUBLIC_KEY') && get('VAPID_PRIVATE_KEY')) return { pub: get('VAPID_PUBLIC_KEY'), priv: get('VAPID_PRIVATE_KEY') };
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  const prefix = env.trim() ? env.trim() + '\n' : '';
  writeFileSync(file, `${prefix}VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=mailto:notif-sim@example.com\n`);
  console.log('Clés VAPID générées dans .env.local');
  return { pub: publicKey, priv: privateKey };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) ensureVapid();
