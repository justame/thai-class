import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { PATHS, SHOW } from './config.js';

// One-time show cover. Spotify requires a square image, minimum 1400x1400. This is a
// plain text-on-color placeholder so the show is unblocked; replace docs/cover.jpg with
// a real image anytime (one commit, no pipeline change).

const SIZE = 1500;
const BG = '#1d3557';
const FG = '#f1faee';
const ACCENT = '#e63946';

function coverSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  <rect x="0" y="${SIZE - 120}" width="${SIZE}" height="120" fill="${ACCENT}"/>
  <text x="50%" y="42%" text-anchor="middle" font-family="sans-serif" font-size="240" fill="${FG}">เรียนไทย</text>
  <text x="50%" y="60%" text-anchor="middle" font-family="sans-serif" font-size="150" font-weight="bold" fill="${FG}">${SHOW.title}</text>
</svg>`;
}

export async function makeCover(outPath = PATHS.cover) {
  await mkdir(PATHS.docs, { recursive: true });
  await sharp(Buffer.from(coverSvg())).jpeg({ quality: 90 }).toFile(outPath);
  return outPath;
}

// Allow `npm run cover` to generate it directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  makeCover().then((p) => console.log(`Cover written to ${p}`));
}
