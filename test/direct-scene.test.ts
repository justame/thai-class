import { describe, it, expect, vi } from 'vitest';

const create = vi.fn(async () => ({
  choices: [{ message: { content: 'TEACHER (warm): เยี่ยมเลย! Great.' } }],
}));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create } }; },
}));

import { directScene } from '../src/direct-scene.js';

describe('directScene', () => {
  it('returns the improved screenplay text', async () => {
    const out = await directScene('TEACHER: good job.', { apiKey: 'k' });
    expect(out).toBe('TEACHER (warm): เยี่ยมเลย! Great.');
  });

  it('puts the original screenplay in the prompt', async () => {
    await directScene('TEACHER: good job.', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toContain('TEACHER: good job.');
  });

  it('carries the charisma rubric (varied Thai praise)', async () => {
    await directScene('TEACHER: good job.', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toMatch(/praise/i);
    expect(arg.messages[0].content).toContain('SCREENPLAY');
  });
});
