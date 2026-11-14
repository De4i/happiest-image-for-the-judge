// Entrypoint for make.fun's "Make the AI judge happy" bounty (ai-happy-01).
//
// The judge sees exactly one image, so this program's whole job is to put the
// committed image at the grader's output path, unchanged, byte for byte, and to
// refuse to write anything the gate would reject. It runs twice per grading and
// both runs must write the same bytes: nothing here reads a clock, a network, or
// anything outside this directory, so the two runs cannot differ.
//
//   node main.ts                                  # writes /output/entry.png
//   MAKEFUN_OUTPUT_DIR=out node main.ts           # writes out/entry.png

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry ships one image; the gate reads it whatever it is called. Prefer the
// submitted name, and take the other spelling when only that one is committed.
const imagePath = ['entry.png', 'entry.jpg']
  .map((name) => join(here, name))
  .find((path) => existsSync(path));
if (!imagePath) throw new Error('no entry.png or entry.jpg beside main.ts');
const image = readFileSync(imagePath);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 1024 * 1024; // the gate's cap: 1 MiB
const MAX_SIDE = 1024; // the gate's cap: 1024 by 1024 pixels

// A whole PNG starts with its signature and an IHDR chunk (length 13, type "IHDR",
// then width and height as big-endian 32-bit integers); its last chunk is IEND.
function pngDimensions(buf: Buffer): [number, number] {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('entry.png is not a whole PNG: bad signature');
  }
  if (buf.readUInt32BE(8) !== 13 || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('entry.png has no IHDR chunk where a whole PNG has one');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const iend = buf.lastIndexOf(Buffer.from('IEND'));
  if (iend < 0 || buf.length !== iend + 8) {
    throw new Error('entry.png does not end with its IEND chunk');
  }
  return [width, height];
}

// A whole JPEG starts with SOI (FFD8) and ends with EOI (FFD9); its size lives in
// the SOFn frame header, which is the first segment whose marker is FFC0..FFCF,
// excluding FFC4 (the Huffman table), FFC8 (a JPEG extension) and FFCC (arithmetic).
function jpegDimensions(buf: Buffer): [number, number] {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) {
    throw new Error('entry.png is not a whole JPEG: no SOI marker');
  }
  if (buf.readUInt16BE(buf.length - 2) !== 0xffd9) {
    throw new Error('entry.png does not end with its EOI marker');
  }
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) throw new Error('entry.png has a malformed JPEG segment');
    const marker = buf[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5)];
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  throw new Error('entry.png carries no JPEG frame header');
}

const [width, height] = image.subarray(0, 8).equals(PNG_SIGNATURE)
  ? pngDimensions(image)
  : jpegDimensions(image);

if (image.byteLength > MAX_BYTES) {
  throw new Error(`entry.png is ${image.byteLength} bytes, over the gate's ${MAX_BYTES}`);
}
if (width > MAX_SIDE || height > MAX_SIDE) {
  throw new Error(`entry.png is ${width}x${height}, over the gate's ${MAX_SIDE} by ${MAX_SIDE}`);
}

mkdirSync(outDir, { recursive: true });
const destination = join(outDir, 'entry.png');
writeFileSync(destination, image);
console.log(
  `wrote ${destination}: ${width}x${height}, ${image.byteLength} bytes, ` +
    `sha256 ${createHash('sha256').update(image).digest('hex')}`,
);
