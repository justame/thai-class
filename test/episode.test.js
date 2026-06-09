import { describe, it, expect } from 'vitest';
import { buildTitle, buildDescription, nextEpisodeNumber } from '../src/episode.js';

const market = { thai: 'ตลาด', english: 'market' };
const eat = { thai: 'กิน', english: 'eat' };

describe('buildTitle', () => {
  it('should list the words with the episode number', () => {
    expect(buildTitle([market, eat], 42)).toBe('Daily Thai #42 — ตลาด, กิน');
  });
});

describe('buildDescription', () => {
  it('should group new and review words', () => {
    const text = buildDescription([eat], [market]);
    expect(text).toContain('New words:');
    expect(text).toContain('ตลาด = market');
    expect(text).toContain('Review words:');
    expect(text).toContain('กิน = eat');
  });

  it('should omit the review section when there are no reviews', () => {
    const text = buildDescription([], [market]);
    expect(text).not.toContain('Review words:');
  });
});

describe('nextEpisodeNumber', () => {
  it('should start at 1 when none exist', () => {
    expect(nextEpisodeNumber(undefined)).toBe(1);
  });

  it('should increment the last number', () => {
    expect(nextEpisodeNumber(41)).toBe(42);
  });
});
