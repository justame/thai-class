import { describe, it, expect } from 'vitest';
import { buildPrompt, checkChunks } from '../src/script.js';

const market = { thai: 'ตลาด', english: 'market', exampleSentences: ['ตลาดนี้ใหญ่มาก'] };
const eat = { thai: 'กิน', english: 'eat', exampleSentences: [] };

describe('buildPrompt', () => {
  it('should list new and review words', () => {
    const prompt = buildPrompt([market], [eat]);
    expect(prompt).toContain('ตลาด = market');
    expect(prompt).toContain('กิน = eat');
  });

  it('should include a dataset example sentence when present', () => {
    const prompt = buildPrompt([market], []);
    expect(prompt).toContain('ตลาดนี้ใหญ่มาก');
  });
});

describe('checkChunks', () => {
  it('should throw on an empty array', () => {
    expect(() => checkChunks([])).toThrow(/no lesson chunks/);
  });

  it('should throw when a chunk has empty text', () => {
    expect(() => checkChunks([{ lang: 'th', text: '  ', role: 'opening' }])).toThrow(/empty chunk/);
  });

  it('should pass valid chunks', () => {
    const chunks = [{ lang: 'th', text: 'สวัสดี', role: 'opening' }];
    expect(checkChunks(chunks)).toBe(chunks);
  });
});
