import { describe, it, expect } from 'vitest';
import { MAX_PAUSE_SECONDS, MIN_PAUSE_SECONDS, DIRECTOR_PASSES } from '../src/config.js';

describe('pause range', () => {
  it('allows the recall beat to reach 6 seconds', () => {
    expect(MAX_PAUSE_SECONDS).toBe(6.0);
  });

  it('keeps the minimum pause at 0.2 seconds', () => {
    expect(MIN_PAUSE_SECONDS).toBe(0.2);
  });
});

describe('director config', () => {
  it('defaults to one critic pass', () => {
    expect(DIRECTOR_PASSES).toBe(1);
  });
});
