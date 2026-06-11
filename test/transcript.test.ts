import { describe, it, expect } from 'vitest';
import { buildTranscript, parseTranscript, readableView, buildHtml, transcriptPath, audioPath, htmlPath, feedbackPath } from '../src/transcript.js';
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

describe('episode paths', () => {
  it('should put the transcript in the episode folder', () => {
    expect(transcriptPath(3).endsWith('episodes/ep-3/transcript.md')).toBe(true);
  });

  it('should put the audio in the same episode folder', () => {
    expect(audioPath(3).endsWith('episodes/ep-3/lesson.mp3')).toBe(true);
  });

  it('should put the html in the same episode folder', () => {
    expect(htmlPath(3).endsWith('episodes/ep-3/index.html')).toBe(true);
  });

  it('should put the feedback in the same episode folder', () => {
    expect(feedbackPath(3).endsWith('episodes/ep-3/feedback.md')).toBe(true);
  });
});

describe('buildHtml', () => {
  it('should embed an audio player pointing at the lesson mp3 in the same folder', () => {
    const html = buildHtml(chunks, meta, { hasAudio: true });
    expect(html).toContain('src="lesson.mp3"');
  });

  it('should show a no-audio note instead of a dead player when the mp3 is missing', () => {
    const html = buildHtml(chunks, meta, { hasAudio: false });
    expect(html).not.toContain('<audio');
    expect(html).toContain('No audio yet');
  });

  it('should show the Thai text of a line', () => {
    expect(buildHtml(chunks, meta)).toContain('ตลาด');
  });

  it('should show the English text of a line', () => {
    expect(buildHtml(chunks, meta)).toContain('It means market.');
  });

  it('should list the lesson words', () => {
    expect(buildHtml(chunks, meta)).toContain('market');
  });

  it('should number the lines so feedback can reference them', () => {
    const html = buildHtml(chunks, meta);
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line="3"');
  });

  it('should escape HTML special characters in the text', () => {
    const evil: Chunk[] = [{ speaker: 'teacher', lang: 'en', text: 'a < b & c', pauseAfter: 0.7 }];
    expect(buildHtml(evil, meta)).toContain('a &lt; b &amp; c');
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
