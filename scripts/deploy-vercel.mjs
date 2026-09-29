// Déploie l'app + le serveur push sur Vercel en une commande : npm run deploy
// (1re fois : la CLI Vercel ouvre le navigateur pour te connecter)
import { spawnSync } from 'node:child_process';
import { ensureVapid } from './vapid.mjs';

const { pub, priv } = ensureVapid();
const vercel = (args, input) => spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
  stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  input,
  shell: true,
});

// Lie le dossier à un projet « notif-sim » (le crée si besoin)
const link = vercel(['link', '--yes', '--project', 'notif-sim']);
if (link.status) process.exit(link.status);

// Clés VAPID en variables d'environnement de production (remplacées si déjà présentes)
for (const [k, v] of [['VAPID_PUBLIC_KEY', pub], ['VAPID_PRIVATE_KEY', priv], ['VAPID_SUBJECT', 'mailto:notif-sim@example.com']]) {
  vercel(['env', 'rm', k, 'production', '--yes']);
  vercel(['env', 'add', k, 'production'], v);
}

const r = vercel(['deploy', '--prod', '--yes']);
process.exit(r.status ?? 0);
