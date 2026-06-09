// Seed data/vocab.json from a real Thai frequency list, English left empty (filled
// lazily on first use — see src/translate.js).
//
// The raw frequency list (OpenSubtitles) is contaminated with broken-encoding fake
// Thai, English words, and particles. We clean it by keeping only words that also
// appear in PyThaiNLP's Thai dictionary — that removes the garbage while preserving
// frequency order. Existing words (and their review progress) are kept by Thai text.
//
// Usage: node scripts/seed-frequency.js [maxWords]   (default 3000)

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeWord, saveVocab, loadVocab } from '../src/vocab.js';
import { today } from '../src/dates.js';
import { PATHS } from '../src/config.js';

const FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/th/th_50k.txt';
const DICT_URL = 'https://raw.githubusercontent.com/PyThaiNLP/pythainlp/dev/pythainlp/corpus/words_th.txt';
const ONLY_THAI = /^[฀-๿]+$/;
const MIN_LENGTH = 2;
const DEFAULT_MAX = 3000;

async function fetchText(url, cachePath) {
  if (existsSync(cachePath)) return readFile(cachePath, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const text = await res.text();
  await mkdir(PATHS.build, { recursive: true });
  await writeFile(cachePath, text, 'utf8');
  return text;
}

// Real Thai words from the frequency list, garbage removed, in frequency order.
function cleanWords(freqText, dictText, max) {
  const dict = new Set(dictText.split(/\r?\n/).map((s) => s.trim()));
  const seen = new Set();
  const words = [];
  for (const line of freqText.split(/\r?\n/)) {
    const word = line.split(' ')[0];
    if (!word || seen.has(word)) continue;
    if (!ONLY_THAI.test(word)) continue; // drop English + latin-mixed mojibake
    if (word.length < MIN_LENGTH) continue; // drop single characters
    if (!dict.has(word)) continue; // must be a real dictionary word
    seen.add(word);
    words.push(word);
    if (words.length >= max) break;
  }
  return words;
}

function makeId(thai, index) {
  return `w${String(index).padStart(5, '0')}_${thai}`;
}

async function main() {
  const max = Number(process.argv[2] ?? DEFAULT_MAX);
  const freqText = await fetchText(FREQ_URL, join(PATHS.build, 'th_freq.txt'));
  const dictText = await fetchText(DICT_URL, join(PATHS.build, 'th_dict.txt'));
  const cleaned = cleanWords(freqText, dictText, max);

  const existingByThai = existsSync(PATHS.vocab)
    ? new Map((await loadVocab()).map((w) => [w.thai, w]))
    : new Map();
  const now = today();

  const words = [];
  cleaned.forEach((thai, index) => {
    const existing = existingByThai.get(thai);
    words.push(existing ?? makeWord({ id: makeId(thai, index), thai, category: 'frequency', dateAdded: now }));
  });

  // Keep any pre-existing words (e.g. the verified starter set) that are not in the
  // frequency list, appended after the frequency-ordered words.
  for (const [thai, word] of existingByThai) {
    if (!cleaned.includes(thai)) words.push(word);
  }

  await saveVocab(words);
  const untranslated = words.filter((w) => !w.english).length;
  console.log(`Seeded ${words.length} words (${untranslated} await lazy translation) to ${PATHS.vocab}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
