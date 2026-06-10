import { describe, it, expect } from 'vitest';
import { checkChunks } from '../src/script.js';

describe('checkChunks', () => {
  it('should throw on an empty array', () => {
    expect(() => checkChunks([])).toThrow(/no lesson chunks/);
  });

  it('should throw when a chunk has empty text', () => {
    expect(() => checkChunks([{ speaker: 'teacher', lang: 'th', text: '  ', pauseAfter: 0.7 }])).toThrow(/empty chunk/);
  });

  it('should pass valid chunks', () => {
    const chunks = [{ speaker: 'teacher', lang: 'th', text: 'สวัสดี', pauseAfter: 0.7 }];
    expect(checkChunks(chunks)).toBe(chunks);
  });
});
