import { describe, it, expect } from 'vitest';
import { buildFeedXml } from '../src/feed.js';
import { parseRepo } from '../src/publish.js';
import type { Episode } from '../src/types.js';

const episode: Episode = {
  number: 1,
  title: 'Daily Thai #1 — ตลาด',
  description: 'New words: ตลาด = market',
  pubDate: '2026-06-09',
  audioUrl: 'https://github.com/u/r/releases/download/ep-1/daily-thai-1.mp3',
  durationSeconds: 67,
  fileSizeBytes: 123456,
};

const opts = { siteBaseUrl: 'https://u.github.io/thai-class', ownerEmail: 'me@example.com' };

describe('buildFeedXml', () => {
  it('should include the required Spotify iTunes tags', () => {
    const xml = buildFeedXml([episode], opts);
    expect(xml).toContain('itunes:image');
    expect(xml).toContain('itunes:category');
    expect(xml).toContain('me@example.com');
  });

  it('should point the enclosure at the release asset', () => {
    const xml = buildFeedXml([episode], opts);
    expect(xml).toContain('daily-thai-1.mp3');
    expect(xml).toContain('audio/mpeg');
  });

  it('should list newest episodes first', () => {
    const ep2: Episode = { ...episode, number: 2, title: 'Daily Thai #2', audioUrl: 'https://x/2.mp3' };
    const xml = buildFeedXml([episode, ep2], opts);
    expect(xml.indexOf('Daily Thai #2')).toBeLessThan(xml.indexOf('Daily Thai #1'));
  });
});

describe('parseRepo', () => {
  it('should split owner and repo', () => {
    expect(parseRepo('yaronn/thai-class')).toEqual({ owner: 'yaronn', repo: 'thai-class' });
  });

  it('should throw on a malformed value', () => {
    expect(() => parseRepo('badvalue')).toThrow(/owner\/repo/);
  });
});
