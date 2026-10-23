import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Standard CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Generate RGBA PNG buffer with shield & vault emblem
function createVaultIconPng(width, height, isMaskable = false) {
  // 1 byte filter per line + width * 4 bytes RGBA
  const rawLineLen = 1 + width * 4;
  const rawData = Buffer.alloc(rawLineLen * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = (width / 2) * (isMaskable ? 0.72 : 0.88);
  const rInner = rOuter * 0.88;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawLineLen;
    rawData[rowOffset] = 0; // Filter 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: deep navy slate #090e1a
      let r = 9, g = 14, b = 26, a = 255;

      if (!isMaskable && dist > rOuter + 2) {
        // Transparent outside circular badge
        a = 0;
        r = 0; g = 0; b = 0;
      } else if (dist <= rOuter && dist > rOuter - 5) {
        // Gold outer ring #f59e0b
        r = 245; g = 158; b = 11; a = 255;
      } else if (dist <= rOuter - 5 && dist > rInner) {
        // Royal navy ring #0f2b5c
        r = 15; g = 43; b = 92; a = 255;
      } else if (dist <= rInner) {
        // Center shield & vault background: rich gradient
        const grad = (y / height);
        r = Math.round(15 + 10 * grad);
        g = Math.round(23 + 20 * grad);
        b = Math.round(42 + 40 * grad);
        a = 255;

        // Draw center shield & document lock icon
        // Shield shape: |x - cx| < width * 0.22, y between cy - height * 0.25 and cy + height * 0.25
        const sx = Math.abs(dx) / (width * 0.24);
        const sy = (dy + height * 0.05) / (height * 0.28);
        if (sx <= 1 && sy >= -1 && (sy <= 0 || sx <= (1 - sy * 0.65))) {
          // Inside shield - amber gold #fbbf24 to #f59e0b
          r = 251 - Math.round(20 * (y / height));
          g = 191 - Math.round(30 * (y / height));
          b = 36;
          // Inner lock / vault symbol:
          const lx = Math.abs(dx) / (width * 0.08);
          const ly = dy / (height * 0.1);
          if (lx <= 1 && ly >= -0.5 && ly <= 0.8) {
            // Dark navy lock body
            r = 15; g = 23; b = 42;
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate all standard PWA icons
console.log('Generating PWA PNG icons in public/...');
fs.writeFileSync(path.resolve(publicDir, 'pwa-192x192.png'), createVaultIconPng(192, 192, false));
fs.writeFileSync(path.resolve(publicDir, 'pwa-512x512.png'), createVaultIconPng(512, 512, false));
fs.writeFileSync(path.resolve(publicDir, 'pwa-maskable-512x512.png'), createVaultIconPng(512, 512, true));
fs.writeFileSync(path.resolve(publicDir, 'apple-touch-icon.png'), createVaultIconPng(180, 180, true));
fs.writeFileSync(path.resolve(publicDir, 'favicon.ico'), createVaultIconPng(64, 64, false));
console.log('Successfully generated pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png, apple-touch-icon.png, favicon.ico');
