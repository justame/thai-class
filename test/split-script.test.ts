import { describe, it, expect } from 'vitest';
import { splitText, splitMixedScriptLines } from '../src/split-script.js';
import type { Chunk } from '../src/types.js';

function chunk(over: Partial<Chunk> = {}): Chunk {
  return { speaker: 'teacher', lang: 'en', text: 'hello', pauseAfter: 1, ...over };
}

describe('splitText', () => {
  it('should keep a pure English line as one English piece', () => {
    expect(splitText('Listen and repeat')).toEqual([{ lang: 'en', text: 'Listen and repeat' }]);
  });

  it('should keep a pure Thai line as one Thai piece', () => {
    expect(splitText('ฉันเจอคน')).toEqual([{ lang: 'th', text: 'ฉันเจอคน' }]);
  });

  it('should split an English sentence ending in a Thai word into English then Thai', () => {
    expect(splitText('Listen and repeat: คน')).toEqual([
      { lang: 'en', text: 'Listen and repeat:' },
      { lang: 'th', text: 'คน' },
    ]);
  });

  it('should split English-Thai-English into three pieces', () => {
    expect(splitText('To recap คน means person')).toEqual([
      { lang: 'en', text: 'To recap' },
      { lang: 'th', text: 'คน' },
      { lang: 'en', text: 'means person' },
    ]);
  });

  it('should strip trailing punctuation from a Thai piece', () => {
    expect(splitText('repeat: อาหาร.')).toEqual([
      { lang: 'en', text: 'repeat:' },
      { lang: 'th', text: 'อาหาร' },
    ]);
  });

  it('should strip quotes hugging a Thai word', () => {
    expect(splitText("the word 'คน' is")).toEqual([
      { lang: 'en', text: "the word '" },
      { lang: 'th', text: 'คน' },
      { lang: 'en', text: 'is' },
    ]);
  });

  it('should drop a punctuation-only piece', () => {
    expect(splitText("อาหาร ' person")).toEqual([
      { lang: 'th', text: 'อาหาร' },
      { lang: 'en', text: 'person' },
    ]);
  });
});

describe('splitMixedScriptLines', () => {
  it('should return chunks unchanged when no line mixes scripts', () => {
    const chunks = [chunk({ lang: 'th', text: 'คน' }), chunk({ lang: 'en', text: "say 'khon'" })];
    expect(splitMixedScriptLines(chunks)).toEqual(chunks);
  });

  it('should split a mixed line into two chunks keeping speaker and order', () => {
    const chunks = [
      chunk({ speaker: 'student2', lang: 'en', text: 'before' }),
      chunk({ speaker: 'teacher', lang: 'en', text: 'Listen: คน', pauseAfter: 2 }),
    ];
    const out = splitMixedScriptLines(chunks);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ speaker: 'teacher', lang: 'en', text: 'Listen:' });
    expect(out[2]).toMatchObject({ speaker: 'teacher', lang: 'th', text: 'คน', pauseAfter: 2 });
  });

  it('should put the original pause on the last piece only', () => {
    const chunks = [chunk({ lang: 'en', text: 'Say: คน', pauseAfter: 3 })];
    const out = splitMixedScriptLines(chunks);
    expect(out[0].pauseAfter).toBeLessThan(3);
    expect(out[1].pauseAfter).toBe(3);
  });

  it('should leave cue lines untouched', () => {
    const chunks = [chunk({ speaker: 'cue', lang: 'en', text: 'new_word' })];
    expect(splitMixedScriptLines(chunks)).toEqual(chunks);
  });
});
