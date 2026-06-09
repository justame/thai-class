import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { makeWord, checkVocab, loadVocab, saveVocab, mergeWords } from '../src/vocab.js';

describe('makeWord', () => {
  it('should create a new word with default SRS fields', () => {
    const w = makeWord({ id: 'w1', thai: 'ก', english: 'a', dateAdded: '2026-06-09' });
    expect(w.intervalIndex).toBe(-1);
    expect(w.nextReviewDate).toBe(null);
    expect(w.timesTaught).toBe(0);
  });
});

describe('checkVocab', () => {
  it('should throw when a required field is missing', () => {
    expect(() => checkVocab([{ id: 'w1', thai: 'ก' }])).toThrow(/english/);
  });

  it('should throw on duplicate ids', () => {
    const dup = [
      makeWord({ id: 'w1', thai: 'ก', english: 'a', dateAdded: '2026-06-09' }),
      makeWord({ id: 'w1', thai: 'ข', english: 'b', dateAdded: '2026-06-09' }),
    ];
    expect(() => checkVocab(dup)).toThrow(/duplicate/);
  });

  it('should pass a valid list', () => {
    const ok = [makeWord({ id: 'w1', thai: 'ก', english: 'a', dateAdded: '2026-06-09' })];
    expect(checkVocab(ok)).toBe(ok);
  });
});

describe('saveVocab and loadVocab', () => {
  it('should round-trip a word list', async () => {
    const path = join(tmpdir(), `vocab-test-${process.pid}.json`);
    const words = [makeWord({ id: 'w1', thai: 'ตลาด', english: 'market', dateAdded: '2026-06-09' })];
    await saveVocab(words, path);
    const loaded = await loadVocab(path);
    expect(loaded).toEqual(words);
    await rm(path, { force: true });
  });

  it('should write fields in stable order for clean diffs', async () => {
    const path = join(tmpdir(), `vocab-order-${process.pid}.json`);
    const words = [makeWord({ id: 'w1', thai: 'ก', english: 'a', dateAdded: '2026-06-09' })];
    await saveVocab(words, path);
    const text = await readFile(path, 'utf8');
    expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"thai"'));
    expect(text.indexOf('"thai"')).toBeLessThan(text.indexOf('"english"'));
    await rm(path, { force: true });
  });
});

describe('mergeWords', () => {
  it('should replace updated words by id and keep order', () => {
    const words = [
      makeWord({ id: 'a', thai: 'ก', english: 'a', dateAdded: '2026-06-09' }),
      makeWord({ id: 'b', thai: 'ข', english: 'b', dateAdded: '2026-06-09' }),
    ];
    const updated = [{ ...words[1], timesTaught: 1 }];
    const merged = mergeWords(words, updated);
    expect(merged[0].timesTaught).toBe(0);
    expect(merged[1].timesTaught).toBe(1);
  });
});
