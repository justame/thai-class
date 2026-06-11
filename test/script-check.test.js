import { describe, it, expect } from 'vitest';
import { findMixedScriptLines, checkNoMixedScript } from '../src/script-check.js';

function chunk(over) {
  return { speaker: 'teacher', lang: 'th', text: 'ไป', pauseAfter: 1, ...over };
}

describe('findMixedScriptLines', () => {
  it('should return nothing for clean Thai and English lines', () => {
    const chunks = [chunk({ lang: 'th', text: 'ฉันจะไปตลาด' }), chunk({ lang: 'en', text: "say 'ja pai'" })];
    expect(findMixedScriptLines(chunks)).toEqual([]);
  });

  it('should flag Latin letters inside a Thai line', () => {
    const chunks = [chunk({ lang: 'th', text: 'ผมเป็นคน good' })];
    expect(findMixedScriptLines(chunks).map((p) => p.index)).toEqual([0]);
  });

  it('should flag Thai script inside an English line', () => {
    const chunks = [chunk({ lang: 'en', text: "here's a sentence: ฉันเป็นคนดี" })];
    expect(findMixedScriptLines(chunks).map((p) => p.index)).toEqual([0]);
  });

  it('should allow accented romanization in an English line', () => {
    const chunks = [chunk({ lang: 'en', text: "say 'jà pai' to a friend" })];
    expect(findMixedScriptLines(chunks)).toEqual([]);
  });

  it('should ignore cue lines', () => {
    const chunks = [chunk({ speaker: 'cue', lang: 'en', text: 'new_word' })];
    expect(findMixedScriptLines(chunks)).toEqual([]);
  });
});

describe('checkNoMixedScript', () => {
  it('should return the chunks unchanged when all lines are clean', () => {
    const chunks = [chunk({ lang: 'th', text: 'ไปตลาด' })];
    expect(checkNoMixedScript(chunks)).toBe(chunks);
  });

  it('should throw listing the offending line when a line mixes scripts', () => {
    const chunks = [chunk({ lang: 'th', text: 'ผมเป็นคน good' })];
    expect(() => checkNoMixedScript(chunks)).toThrow(/mixed script/i);
  });
});
