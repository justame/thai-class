import { describe, it, expect } from 'vitest';
import { parseScene } from '../src/format-scene.js';

describe('parseScene', () => {
  it('maps a speaker label to the chunk speaker', () => {
    const [c] = parseScene('TEACHER: Hello everyone.');
    expect(c.speaker).toBe('teacher');
  });

  it('strips a mood tag from the spoken text', () => {
    const [c] = parseScene('TEACHER (warm): Hello everyone.');
    expect(c.text).toBe('Hello everyone.');
  });

  it('keeps a pure English line as one chunk', () => {
    const chunks = parseScene('TEACHER: I want food in Thai.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].lang).toBe('en');
  });

  it('splits a Thai word out of an English line into its own th chunk', () => {
    const chunks = parseScene('TEACHER: The word is อาหาร today.');
    const langs = chunks.map((c) => c.lang);
    expect(langs).toContain('th');
    expect(langs).toContain('en');
    const thai = chunks.find((c) => c.lang === 'th');
    expect(thai?.text).toBe('อาหาร');
  });

  it('turns a CUE row into a cue chunk', () => {
    const [c] = parseScene('[CUE: new_word]');
    expect(c.speaker).toBe('cue');
    expect(c.text).toBe('new_word');
    expect(c.pauseAfter).toBe(0.3);
  });

  it('applies a wait hint to the last piece of the row', () => {
    const chunks = parseScene('TEACHER: How do you say it? [wait 5s]');
    expect(chunks[chunks.length - 1].pauseAfter).toBe(5);
  });

  it('clamps a wait hint above the ceiling to 6 seconds', () => {
    const chunks = parseScene('TEACHER: Take your time. [wait 99s]');
    expect(chunks[chunks.length - 1].pauseAfter).toBe(6);
  });

  it('gives non-final pieces of one row a short intra-line pause', () => {
    const chunks = parseScene('TEACHER: The word อาหาร means food. [wait 4s]');
    expect(chunks[0].pauseAfter).toBe(0.2);
  });

  it('skips frontmatter, comments and headings', () => {
    const chunks = parseScene('---\ntitle: x\n---\n<!-- note -->\n## Words\nTEACHER: Hi.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Hi.');
  });

  it('throws on a person row with empty text', () => {
    expect(() => parseScene('TEACHER (warm):   ')).toThrow();
  });

  it('never produces a NaN pause from a malformed wait hint', () => {
    const chunks = parseScene('TEACHER: Hi there. [wait .]');
    const last = chunks[chunks.length - 1].pauseAfter;
    expect(Number.isFinite(last)).toBe(true);
  });
});
