import { describe, it, expect } from 'vitest';
import { buildTranscript, parseTranscript, readableView } from '../src/transcript.js';
import { ENGLISH_SPEAKING_RATE } from '../src/config.js';
import type { BuildTranscriptOptions } from '../src/transcript.js';
import type { Chunk, Word } from '../src/types.js';

const chunks: Chunk[] = [
  { speaker: 'teacher', lang: 'th', text: 'ตลาด', pauseAfter: 2, rate: 0.85 },
  { speaker: 'teacher', lang: 'en', text: 'It means market.', pauseAfter: 0.7, rate: 1 },
  { speaker: 'student1', lang: 'th', text: 'ผมตลาดข้าว', pauseAfter: 0.7, rate: 0.85 },
];

const meta: BuildTranscriptOptions = {
  episodeNumber: 1,
  title: 'Daily Thai #1 — ตลาด',
  lessonType: 'classroom',
  words: [{ thai: 'ตลาด', english: 'market' }] as Word[],
  pubDate: '2026-06-09',
};

describe('buildTranscript + parseTranscript', () => {
  it('should round-trip chunks through the transcript', () => {
    const md = buildTranscript(chunks, meta);
    expect(parseTranscript(md)).toEqual(chunks);
  });

  it('should ignore frontmatter, comments, and the Words section when parsing', () => {
    const md = buildTranscript(chunks, meta);
    const parsed = parseTranscript(md);
    expect(parsed).toHaveLength(3);
    expect(parsed.every((c) => c.text !== 'market')).toBe(true);
  });

  it('should keep an edited line', () => {
    const md = buildTranscript(chunks, meta).replace('|0.85] ตลาด', '|0.85] ตลาดสด');
    expect(parseTranscript(md)[0].text).toBe('ตลาดสด');
  });

  it('should read a per-line speed override', () => {
    const parsed = parseTranscript('[teacher|th|1.5|0.6] ไป');
    expect(parsed[0].rate).toBe(0.6);
  });

  it('should fall back to the language default speed when rate is omitted', () => {
    const parsed = parseTranscript('[teacher|en|0.7] hello');
    expect(parsed[0].rate).toBe(ENGLISH_SPEAKING_RATE);
  });
});

describe('readableView', () => {
  it('should label speakers when more than the teacher speaks', () => {
    expect(readableView(chunks)).toContain('Student 1: ผมตลาดข้าว');
  });

  it('should drop labels when only the teacher speaks', () => {
    const solo: Chunk[] = [{ speaker: 'teacher', lang: 'th', text: 'สวัสดี', pauseAfter: 0.7 }];
    expect(readableView(solo)).toBe('สวัสดี');
  });
});
