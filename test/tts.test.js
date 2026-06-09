import { describe, it, expect } from 'vitest';
import { parseDuration } from '../src/tts.js';

describe('parseDuration', () => {
  it('should parse ffmpeg duration into seconds', () => {
    const stderr = 'Input #0\n  Duration: 00:01:07.45, start: 0.0';
    expect(parseDuration(stderr)).toBeCloseTo(67.45, 2);
  });

  it('should return null when no duration line is present', () => {
    expect(parseDuration('no duration here')).toBe(null);
  });
});
