// Génère les icônes PNG (sans dépendance) : sac de shopping blanc sur dégradé vert.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Forme : renvoie true si (x,y) normalisés [0,1] sont dans le sac
function inBag(x, y) {
  // corps : trapèze arrondi
  const top = 0.37, bot = 0.79;
  if (y >= top && y <= bot) {
    const t = (y - top) / (bot - top);
    const half = 0.23 + t * 0.03;
    const r = 0.05;
    const dx = Math.abs(x - 0.5);
    if (dx <= half) {
      // coins inférieurs arrondis
      if (y > bot - r && dx > half - r) {
        const cx = half - r, cy = bot - r;
        return (dx - cx) ** 2 + (y - cy) ** 2 <= r * r;
      }
      return true;
    }
  }
  // anse
  const cx = 0.5, cy = 0.37, R = 0.125, th = 0.038;
  const d = Math.hypot(x - cx, y - cy);
  if (y <= cy && d <= R + th / 2 && d >= R - th / 2) return true;
  return false;
}
// petit point de notification (cercle) en haut à droite du sac
function inDot(x, y) { return Math.hypot(x - 0.735, y - 0.30) <= 0.085; }
function inDotRing(x, y) { return Math.hypot(x - 0.735, y - 0.30) <= 0.115; }

function render(size) {
  const ss = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = (px + (sx + 0.5) / ss) / size, y = (py + (sy + 0.5) / ss) / size;
        // fond dégradé diagonal
        const t = (x + y) / 2;
        let cr = 52 + (10 - 52) * t, cg = 199 + (112 - 199) * t, cb = 124 + (72 - 124) * t;
        if (inDotRing(x, y)) { /* anneau = fond */ }
        if (inBag(x, y) && !inDotRing(x, y)) { cr = 255; cg = 255; cb = 255; }
        if (inDot(x, y)) { cr = 255; cg = 69; cb = 58; }
        r += cr; g += cg; b += cb;
      }
      const n = ss * ss, o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n); raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [180, 192, 512, 96]) writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), render(s));
console.log('icons ok');
