// Generates the PWA icons in public/ with no image dependency.
// Design: a gold vinyl label (the accent colour) on the warm black background.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0e, 0x0d, 0x0b];
const GOLD = [0xf2, 0xc1, 0x4e];
const INK = [0x1a, 0x14, 0x04];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** size x size RGB PNG. `disc` is the gold label radius as a fraction of the size. */
function png(size, disc) {
  const cx = size / 2, cy = size / 2;
  const r = size * disc, hole = size * disc * 0.18;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // 2x2 supersampling for soft edges
      let acc = [0, 0, 0];
      for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const dx = x + sx - cx, dy = y + sy - cy;
        const d = Math.hypot(dx, dy);
        const col = d <= hole ? BG : d <= r * 0.92 ? GOLD : d <= r ? INK : BG;
        acc = acc.map((v, i) => v + col[i]);
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = acc[0] / 4; raw[o + 1] = acc[1] / 4; raw[o + 2] = acc[2] / 4;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192, 0.34));
writeFileSync('public/icon-512.png', png(512, 0.34));
// maskable: keep the disc inside the 80% safe zone
writeFileSync('public/icon-maskable-512.png', png(512, 0.26));
writeFileSync('public/apple-touch-icon.png', png(180, 0.34));
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0e0d0b"/><circle cx="32" cy="32" r="21" fill="#f2c14e"/><circle cx="32" cy="32" r="3.2" fill="#0e0d0b"/></svg>\n`);
console.log('icons written to public/');
