import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal pure-JS PNG encoder for generating crisp, exact-dimension PWA icons
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPng(size, maskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const pad = maskable ? Math.round(size * 0.14) : Math.round(size * 0.08);
  const docLeft = Math.round(size * 0.28) + (maskable ? Math.round(size * 0.04) : 0);
  const docRight = Math.round(size * 0.72) - (maskable ? Math.round(size * 0.04) : 0);
  const docTop = Math.round(size * 0.20) + (maskable ? Math.round(size * 0.04) : 0);
  const docBottom = Math.round(size * 0.80) - (maskable ? Math.round(size * 0.04) : 0);

  const badgeCx = Math.round(size * 0.65);
  const badgeCy = Math.round(size * 0.68);
  const badgeR = Math.round(size * 0.12);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Background: Deep corporate blue #1E3A8A (30, 58, 138)
      let r = 30, g = 58, b = 138, a = 255;

      // Subtle gradient
      r = Math.min(255, Math.round(24 + (y / size) * 16));
      g = Math.min(255, Math.round(52 + (y / size) * 24));
      b = Math.min(255, Math.round(125 + (y / size) * 35));

      // White document sheet
      if (x >= docLeft && x <= docRight && y >= docTop && y <= docBottom) {
        r = 255; g = 255; b = 255;
        // Blue header bar inside document
        const barTop = docTop + Math.round((docBottom - docTop) * 0.12);
        const barBottom = docTop + Math.round((docBottom - docTop) * 0.22);
        const barLeft = docLeft + Math.round((docRight - docLeft) * 0.14);
        const barRight = docRight - Math.round((docRight - docLeft) * 0.14);
        if (x >= barLeft && x <= barRight && y >= barTop && y <= barBottom) {
          r = 30; g = 58; b = 138;
        }
        // Content lines inside document
        for (let line = 0; line < 3; line++) {
          const lTop = docTop + Math.round((docBottom - docTop) * (0.34 + line * 0.12));
          const lBottom = lTop + Math.max(2, Math.round(size * 0.025));
          const lRight = line === 2 ? barLeft + Math.round((barRight - barLeft) * 0.65) : barRight;
          if (x >= barLeft && x <= lRight && y >= lTop && y <= lBottom) {
            r = 148; g = 163; b = 184;
          }
        }
      }

      // Sky-blue verification seal badge
      const dx = x - badgeCx;
      const dy = y - badgeCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= badgeR) {
        r = 2; g = 132; b = 199;
        // White inner ring
        if (Math.abs(dist - badgeR * 0.82) <= Math.max(1.2, size * 0.008)) {
          r = 255; g = 255; b = 255;
        }
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createIconPng(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createIconPng(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createIconPng(512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createIconPng(180, false));
console.log('Generated PWA icons successfully.');
