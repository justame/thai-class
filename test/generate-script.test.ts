import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/write-scene.js', () => ({
  writeScene: vi.fn(async () => '[CUE: start]\nTEACHER: The word is อาหาร.'),
}));
const { directScene } = vi.hoisted(() => ({ directScene: vi.fn(async (s: string) => s) }));
vi.mock('../src/direct-scene.js', () => ({ directScene }));
vi.mock('../src/verify.js', () => ({
  reviewThai: vi.fn(async (chunks: any) => ({ chunks, issues: [] })),
}));

import { generateScript } from '../src/script.js';
import { writeScene } from '../src/write-scene.js';

const WORD = { id: 'w1', thai: 'อาหาร', english: 'food', exampleSentences: [] };

describe('generateScript', () => {
  it('produces chunks from the screenplay', async () => {
    const chunks = await generateScript([WORD as any], [], { lessonType: 'classroom' });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.speaker === 'cue' && c.text === 'start')).toBe(true);
    expect(chunks.some((c) => c.lang === 'th' && c.text === 'อาหาร')).toBe(true);
  });

  // Regression for ep-5: a female teacher MODELING what a male student should say writes
  // ครับ. No deterministic post-processor may flip it to ค่ะ — that taught "male = ค่ะ".
  it('keeps ครับ when the teacher models male speech', async () => {
    vi.mocked(writeScene).mockResolvedValueOnce('TEACHER: A man says คำตอบครับ');
    const chunks = await generateScript([WORD as any], [], { lessonType: 'classroom' });
    expect(chunks.some((c) => c.lang === 'th' && c.text.includes('ครับ'))).toBe(true);
    expect(chunks.some((c) => c.lang === 'th' && c.text.includes('ค่ะ'))).toBe(false);
  });

  it('runs the Director DIRECTOR_PASSES times', async () => {
    directScene.mockClear();
    await generateScript([WORD as any], [], { lessonType: 'classroom' });
    expect(directScene).toHaveBeenCalledTimes(1); // default directorPasses = 1
  });
});
