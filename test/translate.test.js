import { describe, it, expect } from 'vitest';
import { needsTranslation, addTranslations } from '../src/translate.js';

describe('needsTranslation', () => {
  it('should be true when english is empty', () => {
    expect(needsTranslation({ thai: 'ก', english: '' })).toBe(true);
  });

  it('should be true when english is only whitespace', () => {
    expect(needsTranslation({ thai: 'ก', english: '   ' })).toBe(true);
  });

  it('should be false when english is present', () => {
    expect(needsTranslation({ thai: 'ก', english: 'a' })).toBe(false);
  });
});

describe('addTranslations', () => {
  it('should skip the API call when every word already has english', async () => {
    const words = [{ thai: 'ก', english: 'a' }];
    // No apiKey passed; if it tried to call the API it would throw. It must not.
    await expect(addTranslations(words)).resolves.toEqual(words);
  });
});
