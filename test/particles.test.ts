import { describe, it, expect } from 'vitest';
import { fixGenderParticles } from '../src/particles.js';
import type { Chunk } from '../src/types.js';

describe('fixGenderParticles', () => {
  it('should give the male student ครับ instead of ค่ะ', () => {
    const [c] = fixGenderParticles([{ speaker: 'student1', lang: 'th', text: 'ผมไปตลาดค่ะ', pauseAfter: 1 }]);
    expect(c.text).toBe('ผมไปตลาดครับ');
  });

  it('should give the female teacher ค่ะ instead of ครับ on a statement', () => {
    const [c] = fixGenderParticles([{ speaker: 'teacher', lang: 'th', text: 'เก่งมากครับ', pauseAfter: 1 }]);
    expect(c.text).toBe('เก่งมากค่ะ');
  });

  it('should use คะ for a female question', () => {
    const [c] = fixGenderParticles([{ speaker: 'student2', lang: 'th', text: 'ไปไหนครับ', pauseAfter: 1 }]);
    expect(c.text).toBe('ไปไหนคะ');
  });

  it('should give the female teacher ครับ when she models a male sentence (line uses ผม)', () => {
    const [c] = fixGenderParticles([{ speaker: 'teacher', lang: 'th', text: 'ผมชอบอาหารค่ะ', pauseAfter: 1 }]);
    expect(c.text).toBe('ผมชอบอาหารครับ');
  });

  it('should keep the female teacher ค่ะ on her own (non-ผม) line', () => {
    const [c] = fixGenderParticles([{ speaker: 'student2', lang: 'th', text: 'ฉันชอบอาหารครับ', pauseAfter: 1 }]);
    expect(c.text).toBe('ฉันชอบอาหารค่ะ');
  });

  it('should not touch English lines', () => {
    const [c] = fixGenderParticles([{ speaker: 'teacher', lang: 'en', text: 'good ครับ', pauseAfter: 1 }]);
    expect(c.text).toBe('good ครับ');
  });

  it('should leave cue chunks alone', () => {
    const [c] = fixGenderParticles([{ speaker: 'cue', lang: 'en', text: 'correct', pauseAfter: 1 }]);
    expect(c.text).toBe('correct');
  });
});
