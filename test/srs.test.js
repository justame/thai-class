import { describe, it, expect } from 'vitest';
import {
  isNew,
  isDue,
  getDueWords,
  getNewWords,
  advanceWord,
  selectLessonWords,
  NEW_INDEX,
} from '../src/srs.js';
import { REVIEWS_PER_LESSON, NEW_PER_LESSON } from '../src/config.js';

const TODAY = '2026-06-09';

function word(over) {
  return {
    id: 'w1',
    thai: 'ก',
    english: 'a',
    category: 'general',
    dateAdded: TODAY,
    timesTaught: 0,
    lastSeen: null,
    intervalIndex: NEW_INDEX,
    nextReviewDate: null,
    exampleSentences: [],
    ...over,
  };
}

describe('isNew', () => {
  it('should be true for a never-taught word', () => {
    expect(isNew(word())).toBe(true);
  });

  it('should be false once taught', () => {
    expect(isNew(word({ intervalIndex: 0 }))).toBe(false);
  });
});

describe('isDue', () => {
  it('should be false for a new word', () => {
    expect(isDue(word(), TODAY)).toBe(false);
  });

  it('should be true when next review date is today', () => {
    expect(isDue(word({ intervalIndex: 0, nextReviewDate: TODAY }), TODAY)).toBe(true);
  });

  it('should be true when overdue', () => {
    expect(isDue(word({ intervalIndex: 1, nextReviewDate: '2026-06-01' }), TODAY)).toBe(true);
  });

  it('should be false when review date is in the future', () => {
    expect(isDue(word({ intervalIndex: 0, nextReviewDate: '2026-06-20' }), TODAY)).toBe(false);
  });
});

describe('getDueWords', () => {
  it('should sort most overdue first', () => {
    const words = [
      word({ id: 'b', intervalIndex: 0, nextReviewDate: '2026-06-08' }),
      word({ id: 'a', intervalIndex: 0, nextReviewDate: '2026-06-01' }),
    ];
    expect(getDueWords(words, TODAY).map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('should exclude future and new words', () => {
    const words = [
      word({ id: 'new' }),
      word({ id: 'future', intervalIndex: 0, nextReviewDate: '2026-12-01' }),
      word({ id: 'due', intervalIndex: 0, nextReviewDate: TODAY }),
    ];
    expect(getDueWords(words, TODAY).map((w) => w.id)).toEqual(['due']);
  });
});

describe('getNewWords', () => {
  it('should return new words in file order', () => {
    const words = [word({ id: 'a' }), word({ id: 'taught', intervalIndex: 0 }), word({ id: 'b' })];
    expect(getNewWords(words).map((w) => w.id)).toEqual(['a', 'b']);
  });
});

describe('advanceWord', () => {
  it('should move a new word to the first rung', () => {
    const result = advanceWord(word(), TODAY);
    expect(result.intervalIndex).toBe(0);
    expect(result.nextReviewDate).toBe('2026-06-10');
    expect(result.timesTaught).toBe(1);
    expect(result.lastSeen).toBe(TODAY);
  });

  it('should move from rung 0 to rung 1 (3 days)', () => {
    const result = advanceWord(word({ intervalIndex: 0, timesTaught: 1 }), TODAY);
    expect(result.intervalIndex).toBe(1);
    expect(result.nextReviewDate).toBe('2026-06-12');
  });

  it('should stay on the last rung forever', () => {
    const last = word({ intervalIndex: 4, timesTaught: 5 });
    const result = advanceWord(last, TODAY);
    expect(result.intervalIndex).toBe(4);
    expect(result.nextReviewDate).toBe('2026-07-09');
    expect(result.timesTaught).toBe(6);
  });
});

describe('selectLessonWords', () => {
  it('should cap reviews and new words and pick most-overdue reviews first', () => {
    const words = [
      word({ id: 'n1' }),
      word({ id: 'n2' }),
      word({ id: 'n3' }),
      word({ id: 'r1', intervalIndex: 0, nextReviewDate: '2026-06-01' }),
      word({ id: 'r2', intervalIndex: 0, nextReviewDate: '2026-06-02' }),
      word({ id: 'r3', intervalIndex: 0, nextReviewDate: '2026-06-03' }),
    ];
    const { reviews, news } = selectLessonWords(words, TODAY);
    expect(reviews).toHaveLength(REVIEWS_PER_LESSON);
    expect(news).toHaveLength(NEW_PER_LESSON);
    // most overdue review and first new word come first
    expect(reviews[0].id).toBe('r1');
    expect(news[0].id).toBe('n1');
  });

  it('should return no reviews when nothing is due', () => {
    const words = [word({ id: 'n1' }), word({ id: 'n2' })];
    const { reviews, news } = selectLessonWords(words, TODAY);
    expect(reviews).toEqual([]);
    expect(news).toHaveLength(NEW_PER_LESSON);
    expect(news[0].id).toBe('n1');
  });
});
