import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';

export interface WriteSceneOptions {
  apiKey?: string;
}

// Stage 1 of generation: turn the lesson instructions into a natural screenplay. No JSON
// schema on purpose — a free-form scene reads warmer than a model filling a rigid form.
export async function writeScene(prompt: string, { apiKey }: WriteSceneOptions = {}): Promise<string> {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return getMessageContent(completion).trim();
}
