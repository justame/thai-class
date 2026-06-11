import { describe, it, expect } from 'vitest';
import { summarizeVocab, findUndertaughtWords } from '../src/audit.js';
import { NEW_INDEX } from '../src/srs.js';

const TODAY = '2026-06-11';

function word(over) {
  return {
    id: 'w1',
    thai: 'ก',
    english: 'a',
    timesTaught: 0,
    intervalIndex: NEW_INDEX,
    nextReviewDate: null,
    ...over,
  };
}

describe('findUndertaughtWords', () => {
  it('should return started words below the exposure target', () => {
    const words = [
      word({ id: 'started-low', intervalIndex: 0, timesTaught: 2 }),
      word({ id: 'started-enough', intervalIndex: 4, timesTaught: 10 }),
      word({ id: 'never-taught' }),
    ];
    expect(findUndertaughtWords(words, 10).map((w) => w.id)).toEqual(['started-low']);
  });
});

describe('summarizeVocab', () => {
  it('should count new, started, due, and undertaught words', () => {
    const words = [
      word({ id: 'new' }),
      word({ id: 'due', intervalIndex: 0, timesTaught: 1, nextReviewDate: '2026-06-01' }),
      word({ id: 'learned', intervalIndex: 4, timesTaught: 12, nextReviewDate: '2026-12-01' }),
    ];
    const summary = summarizeVocab(words, TODAY, 10);
    expect(summary.total).toBe(3);
    expect(summary.newWords).toBe(1);
    expect(summary.started).toBe(2);
    expect(summary.due).toBe(1);
    expect(summary.undertaught).toBe(1);
  });
});
