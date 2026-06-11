import { describe, it, expect } from 'vitest';
import { buildLessonPrompt } from '../src/lessons.js';

const WORD = { id: 'w1', thai: 'อาหาร', english: 'food', exampleSentences: [] };

describe('buildLessonPrompt output contract', () => {
  it('asks for a screenplay, not JSON chunks', async () => {
    const prompt = await buildLessonPrompt('classroom', [WORD as any], []);
    expect(prompt).toContain('SCREENPLAY');
    expect(prompt).toContain('[CUE:');
    expect(prompt).not.toContain('json_schema');
    expect(prompt).not.toContain('pauseAfter');
  });

  it('explains the [wait Ns] pause hint', async () => {
    const prompt = await buildLessonPrompt('classroom', [WORD as any], []);
    expect(prompt).toContain('[wait');
  });
});
