import { describe, it, expect, vi } from 'vitest';

const create = vi.fn(async () => ({
  choices: [{ message: { content: 'TEACHER: Hello.' } }],
}));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create } }; },
}));

import { writeScene } from '../src/write-scene.js';

describe('writeScene', () => {
  it('returns the model screenplay text', async () => {
    const out = await writeScene('LESSON PROMPT', { apiKey: 'k' });
    expect(out).toBe('TEACHER: Hello.');
  });

  it('sends the lesson prompt to the model', async () => {
    await writeScene('LESSON PROMPT', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toContain('LESSON PROMPT');
  });

  it('does not request a json_schema response', async () => {
    await writeScene('LESSON PROMPT', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.response_format).toBeUndefined();
  });
});
