import { INTERVALS_DAYS, REVIEWS_PER_LESSON, NEW_PER_LESSON } from './config.js';
import { addDays, compareDates } from './dates.js';

// A word is "new" until it has been taught once. intervalIndex === NEW_INDEX means
// it has never been in a lesson and is available immediately.
export const NEW_INDEX = -1;

export function isNew(word) {
  return word.intervalIndex === NEW_INDEX;
}

// Due = already taught and its next review date is today or earlier.
export function isDue(word, today) {
  if (isNew(word)) return false;
  if (!word.nextReviewDate) return false;
  return compareDates(word.nextReviewDate, today) <= 0;
}

// Most overdue first (oldest nextReviewDate first), then by id for a stable order.
export function getDueWords(words, today) {
  return words
    .filter((w) => isDue(w, today))
    .sort(
      (a, b) =>
        compareDates(a.nextReviewDate, b.nextReviewDate) || a.id.localeCompare(b.id),
    );
}

// New words in file order (the file is seeded by frequency, most useful first).
export function getNewWords(words) {
  return words.filter(isNew);
}

// Move a word one rung up the ladder and set its next review date.
// After the last rung it stays on the last rung (review-forever).
export function advanceWord(word, today) {
  const nextIndex = Math.min(word.intervalIndex + 1, INTERVALS_DAYS.length - 1);
  return {
    ...word,
    intervalIndex: nextIndex,
    nextReviewDate: addDays(today, INTERVALS_DAYS[nextIndex]),
    timesTaught: word.timesTaught + 1,
    lastSeen: today,
  };
}

// Pick the words for one lesson: due reviews first (capped), then new words (capped).
export function selectLessonWords(words, today) {
  const reviews = getDueWords(words, today).slice(0, REVIEWS_PER_LESSON);
  const news = getNewWords(words).slice(0, NEW_PER_LESSON);
  return { reviews, news, all: [...news, ...reviews] };
}
