import { isNew, isDue } from './srs.js';
import type { Word } from './types.js';

// Read-only health check on the vocab schedule. The format teaches 1 new word per
// episode and reviews 1 word per episode, so words can be added faster than they come
// back for review. A word needs ~10-12 spaced exposures to stick, so if the review
// backlog grows or many started words stay under target, learning silently stalls.
// This module only reports; it never changes the schedule (that is a pedagogy decision).

// Words that have been taught at least once but are still below the exposure target.
// Never-taught words are not "undertaught" — they simply have not started yet.
export function findUndertaughtWords(words: Word[], target: number): Word[] {
  return words.filter((w) => !isNew(w) && w.timesTaught < target);
}

export interface VocabSummary {
  total: number;
  newWords: number;
  started: number;
  due: number;
  undertaught: number;
  undertaughtWords: Word[];
}

export function summarizeVocab(words: Word[], today: string, target: number): VocabSummary {
  const started = words.filter((w) => !isNew(w));
  const due = words.filter((w) => isDue(w, today));
  const undertaught = findUndertaughtWords(words, target);
  return {
    total: words.length,
    newWords: words.filter(isNew).length,
    started: started.length,
    due: due.length,
    undertaught: undertaught.length,
    undertaughtWords: undertaught,
  };
}
