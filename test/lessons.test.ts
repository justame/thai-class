import { describe, it, expect } from 'vitest';
import { parseFrontmatter, chooseLessonType, buildLessonPrompt, formatWords, formatFeedbackRules } from '../src/lessons.js';
import type { Word } from '../src/types.js';

describe('parseFrontmatter', () => {
  it('should split frontmatter meta from body', () => {
    const text = '---\nname: Test\ndescription: A test\n---\nbody here';
    const { meta, body } = parseFrontmatter(text);
    expect(meta.name).toBe('Test');
    expect(meta.description).toBe('A test');
    expect(body).toBe('body here');
  });

  it('should treat text without frontmatter as all body', () => {
    expect(parseFrontmatter('just body').body).toBe('just body');
  });
});

describe('chooseLessonType', () => {
  it('should use the fixed type', () => {
    expect(chooseLessonType({ mode: 'fixed', type: 'micro' }, 5)).toBe('micro');
  });

  it('should step through the rotation by episode number', () => {
    const plan = { mode: 'rotate', rotation: ['a', 'b', 'c'] };
    expect(chooseLessonType(plan, 1)).toBe('a');
    expect(chooseLessonType(plan, 2)).toBe('b');
    expect(chooseLessonType(plan, 4)).toBe('a');
  });

  it('should default to micro when nothing is set', () => {
    expect(chooseLessonType({}, 1)).toBe('micro');
  });
});

describe('formatWords', () => {
  it('should format a word with its example sentence', () => {
    const out = formatWords([{ thai: 'ตลาด', english: 'market', exampleSentences: ['ตลาดนี้ใหญ่'] }] as Word[]);
    expect(out).toContain('ตลาด = market');
    expect(out).toContain('ตลาดนี้ใหญ่');
  });

  it('should return (none) for an empty list', () => {
    expect(formatWords([])).toBe('(none)');
  });
});

describe('formatFeedbackRules', () => {
  it('should return an empty string when there are no rules', () => {
    expect(formatFeedbackRules('   \n  ')).toBe('');
  });

  it('should wrap rules in a labeled block the model can follow', () => {
    const out = formatFeedbackRules('- Keep English to one sentence');
    expect(out).toContain('FEEDBACK RULES');
    expect(out).toContain('- Keep English to one sentence');
  });
});

describe('buildLessonPrompt', () => {
  it('should fill the micro skill with words and append the output contract', async () => {
    const prompt = await buildLessonPrompt(
      'micro',
      [{ thai: 'ตลาด', english: 'market' }] as Word[],
      [{ thai: 'กิน', english: 'eat' }] as Word[],
    );
    expect(prompt).toContain('ตลาด = market');
    expect(prompt).toContain('กิน = eat');
    expect(prompt).toContain('OUTPUT FORMAT');
    expect(prompt).toContain('pauseAfter');
  });

  it('should throw for an unknown lesson type', async () => {
    await expect(buildLessonPrompt('nope', [], [])).rejects.toThrow(/not found/);
  });
});
