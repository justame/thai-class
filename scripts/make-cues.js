import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { PATHS } from '../src/config.js';

// Generate soft, friendly placeholder cue chimes (one-time). Gentle and quiet, not
// childish or loud. Replace the files in assets/cues/ with nicer chimes anytime — the
// pipeline just plays whatever wav is there. Run: node scripts/make-cues.js

const SAMPLE_RATE = 24000;
const NOTE_SECONDS = 0.16;
const VOLUME = 0.22;

// name -> list of note frequencies (Hz). Rising = upbeat, falling = closing.
const CUES = {
  start: [523, 659, 784], // welcoming rise
  new_word: [784], // attention
  try: [659], // your turn
  correct: [523, 784], // happy ding
  practice: [587], // soft prompt
  recap: [784, 523], // warm close
};

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let err = '';
    proc.stderr.on('data', (d) => {
      err += d.toString();
    });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

async function makeCue(name, notes) {
  const inputs = notes.flatMap((f) => ['-f', 'lavfi', '-i', `sine=frequency=${f}:duration=${NOTE_SECONDS}`]);
  const concatInputs = notes.map((_, i) => `[${i}:a]`).join('');
  const total = (NOTE_SECONDS * notes.length).toFixed(3);
  const fadeOut = Math.max(0, NOTE_SECONDS * notes.length - 0.1).toFixed(3);
  const filter = `${concatInputs}concat=n=${notes.length}:v=0:a=1,volume=${VOLUME},afade=t=in:d=0.02,afade=t=out:st=${fadeOut}:d=0.1`;
  const out = join(PATHS.cues, `${name}.wav`);
  await run(['-y', ...inputs, '-filter_complex', filter, '-t', total, '-ar', String(SAMPLE_RATE), '-ac', '1', out]);
  console.log(`wrote ${out}`);
}

async function main() {
  await mkdir(PATHS.cues, { recursive: true });
  for (const [name, notes] of Object.entries(CUES)) await makeCue(name, notes);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
