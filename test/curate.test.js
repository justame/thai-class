import { describe, it, expect } from 'vitest';
import { needsObviousTag, tagObviousWords } from '../src/curate.js';

describe('needsObviousTag', () => {
  it('should be true when the word was never tagged', () => {
    expect(needsObviousTag({ thai: 'ก' })).toBe(true);
  });

  it('should be false when tagged obvious', () => {
    expect(needsObviousTag({ thai: 'ก', obvious: true })).toBe(false);
  });

  it('should be false when tagged not obvious', () => {
    expect(needsObviousTag({ thai: 'ก', obvious: false })).toBe(false);
  });
});

describe('tagObviousWords', () => {
  it('should skip the API call when every word is already tagged', async () => {
    const words = [{ thai: 'ก', obvious: false }];
    // No apiKey passed; if it tried to call the API it would throw. It must not.
    await expect(tagObviousWords(words)).resolves.toEqual(words);
  });
});
