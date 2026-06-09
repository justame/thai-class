// One-time seed: turn a CSV of Thai words into data/vocab.json.
//
// CSV format (header required): thai,english,category
// Usage: node scripts/seed.js [path/to/words.csv]
// Default input: scripts/starter-words.csv
//
// NOTE: The "Thai frequency 4000" Anki deck cannot be auto-downloaded (AnkiWeb needs a
// login and ships an .apkg = zipped SQLite). To bulk-import it: open the deck in Anki,
// File -> Export -> Notes in Plain Text (.txt), save as CSV with a thai,english,category
// header, then run this script against it. Existing review progress is preserved for
// words whose id (the Thai text) already exists.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { makeWord, saveVocab, loadVocab } from '../src/vocab.js';
import { today } from '../src/dates.js';
import { PATHS } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = join(__dirname, 'starter-words.csv');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const thaiCol = header.indexOf('thai');
  const englishCol = header.indexOf('english');
  const categoryCol = header.indexOf('category');
  if (thaiCol === -1 || englishCol === -1) {
    throw new Error('CSV must have a header with "thai" and "english" columns');
  }
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      thai: cols[thaiCol]?.trim(),
      english: cols[englishCol]?.trim(),
      category: categoryCol === -1 ? 'general' : cols[categoryCol]?.trim() || 'general',
    };
  });
}

// The Thai text is the stable id: re-seeding keeps the SRS progress of known words.
function makeId(thai, index) {
  return `w${String(index).padStart(5, '0')}_${thai}`;
}

async function loadExisting() {
  if (!existsSync(PATHS.vocab)) return new Map();
  const words = await loadVocab();
  return new Map(words.map((w) => [w.thai, w]));
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const rows = parseCsv(await readFile(csvPath, 'utf8'));
  const existingByThai = await loadExisting();
  const now = today();

  const seen = new Set();
  const words = [];
  let index = 0;
  for (const row of rows) {
    if (!row.thai || !row.english) continue;
    if (seen.has(row.thai)) continue; // skip duplicate Thai entries
    seen.add(row.thai);
    const existing = existingByThai.get(row.thai);
    if (existing) {
      words.push({ ...existing, english: row.english, category: row.category });
    } else {
      words.push(
        makeWord({ id: makeId(row.thai, index), thai: row.thai, english: row.english, category: row.category, dateAdded: now }),
      );
    }
    index += 1;
  }

  await saveVocab(words);
  console.log(`Seeded ${words.length} words to ${PATHS.vocab} (from ${csvPath})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
