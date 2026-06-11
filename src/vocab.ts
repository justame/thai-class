import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PATHS } from './config.js';
import { NEW_INDEX } from './srs.js';
import type { Word } from './types.js';

// Fields every word record must have. Keeping a fixed order means the daily commit
// only diffs the few words that changed, not the whole reordered file.
const FIELD_ORDER = [
  'id',
  'thai',
  'english',
  'category',
  'dateAdded',
  'timesTaught',
  'lastSeen',
  'intervalIndex',
  'nextReviewDate',
  'exampleSentences',
];

// english is intentionally NOT required: words are seeded Thai-only and translated
// lazily, only when a word is first used in a lesson (see translate.ts + run.ts).
const REQUIRED_FIELDS = ['id', 'thai'];

export interface MakeWordInput {
  id: string;
  thai: string;
  english?: string;
  category?: string;
  dateAdded: string;
  exampleSentences?: string[];
}

export function makeWord({
  id,
  thai,
  english = '',
  category = 'general',
  dateAdded,
  exampleSentences = [],
}: MakeWordInput): Word {
  return {
    id,
    thai,
    english,
    category,
    dateAdded,
    timesTaught: 0,
    lastSeen: null,
    intervalIndex: NEW_INDEX,
    nextReviewDate: null,
    exampleSentences,
  };
}

// Throws on the first malformed record. A typo'd key would otherwise silently break
// selection (JSON has no schema), so we check on load.
export function checkVocab(words: unknown): Word[] {
  if (!Array.isArray(words)) throw new Error('vocab must be an array');
  const seen = new Set<string>();
  for (const w of words as Record<string, unknown>[]) {
    for (const field of REQUIRED_FIELDS) {
      if (w[field] === undefined || w[field] === null || w[field] === '') {
        throw new Error(`word ${w.id ?? '(no id)'} missing required field "${field}"`);
      }
    }
    if (seen.has(w.id as string)) throw new Error(`duplicate word id "${w.id}"`);
    seen.add(w.id as string);
  }
  return words as Word[];
}

function orderFields(word: Word): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  const record = word as unknown as Record<string, unknown>;
  for (const field of FIELD_ORDER) ordered[field] = record[field];
  // Preserve any extra fields added later, after the known ones.
  for (const key of Object.keys(record)) {
    if (!(key in ordered)) ordered[key] = record[key];
  }
  return ordered;
}

export async function loadVocab(path: string = PATHS.vocab): Promise<Word[]> {
  const raw = await readFile(path, 'utf8');
  return checkVocab(JSON.parse(raw));
}

export async function saveVocab(words: Word[], path: string = PATHS.vocab): Promise<void> {
  checkVocab(words);
  const ordered = words.map(orderFields);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

// Replace changed words in the full list by id, keeping original order.
export function mergeWords(words: Word[], updated: Word[]): Word[] {
  const byId = new Map(updated.map((w) => [w.id, w]));
  return words.map((w) => byId.get(w.id) ?? w);
}
