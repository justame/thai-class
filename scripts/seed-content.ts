// Seed data/vocab.json with real, teachable CONTENT words.
//
// 1. Get frequency-ordered real Thai words (frequency list ∩ dictionary).
// 2. Curate with the LLM to keep only content words (drop particles, pronouns,
//    conjunctions, classifiers, question words, names, and loanwords like โอเค).
// 3. Seed in frequency order; English is left empty (translated lazily on first use).
// Existing words keep their review progress (matched by Thai text).
//
// Usage: node scripts/seed-content.js [candidateCount]   (default 1500)

import 'dotenv/config';
import { existsSync } from 'node:fs';
import { makeWord, saveVocab, loadVocab } from '../src/vocab.js';
import { getCandidateWords } from '../src/wordlist.js';
import { keepContentWords } from '../src/curate.js';
import { today } from '../src/dates.js';
import { PATHS } from '../src/config.js';
import type { Word } from '../src/types.js';

const DEFAULT_CANDIDATES = 1500;

function makeId(thai: string, index: number): string {
  return `w${String(index).padStart(5, '0')}_${thai}`;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');

  const candidateCount = Number(process.argv[2] ?? DEFAULT_CANDIDATES);
  console.log(`Getting ${candidateCount} candidate words...`);
  const candidates = await getCandidateWords(candidateCount);

  console.log('Curating to content words (LLM)...');
  const content = await keepContentWords(candidates, {
    onProgress: (done, total, kept) => console.log(`  ${done}/${total} checked, ${kept} kept`),
  });

  const existingByThai = existsSync(PATHS.vocab)
    ? new Map((await loadVocab()).map((w) => [w.thai, w]))
    : new Map<string, Word>();
  const now = today();

  const words = content.map((thai, index) => {
    const existing = existingByThai.get(thai);
    return existing ?? makeWord({ id: makeId(thai, index), thai, category: 'content', dateAdded: now });
  });

  await saveVocab(words);
  const dropped = candidates.length - content.length;
  console.log(`Seeded ${words.length} content words (dropped ${dropped} function/loan/name words).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
