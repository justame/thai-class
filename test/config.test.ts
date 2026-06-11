import { describe, it, expect } from 'vitest';
import { stripJsonComments, mergeConfig, CONFIG_DEFAULTS } from '../src/config.js';

describe('stripJsonComments', () => {
  it('should remove a full-line comment so the result parses as JSON', () => {
    const text = '{\n  // the speed\n  "thaiSpeakingRate": 0.5\n}';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ thaiSpeakingRate: 0.5 });
  });

  it('should remove a trailing comment after a value', () => {
    const text = '{ "openaiModel": "gpt-4o" } // a note';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ openaiModel: 'gpt-4o' });
  });

  it('should keep a // that lives inside a string value', () => {
    const text = '{ "openaiModel": "http://x" }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ openaiModel: 'http://x' });
  });
});

describe('mergeConfig', () => {
  it('should use the override when a key is present', () => {
    const merged = mergeConfig(CONFIG_DEFAULTS, { thaiSpeakingRate: 0.5 });
    expect(merged.thaiSpeakingRate).toBe(0.5);
  });

  it('should fall back to the default when a key is missing', () => {
    const merged = mergeConfig(CONFIG_DEFAULTS, { thaiSpeakingRate: 0.5 });
    expect(merged.englishSpeakingRate).toBe(CONFIG_DEFAULTS.englishSpeakingRate);
  });

  it('should ignore unknown keys in the override', () => {
    const merged = mergeConfig(CONFIG_DEFAULTS, { nonsense: 9 } as Record<string, unknown>);
    expect('nonsense' in merged).toBe(false);
  });
});
