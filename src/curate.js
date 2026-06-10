import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';

// The raw frequency list is topped by function words (particles, pronouns, conjunctions)
// and loanwords like โอเค — none of which make a teachable vocabulary lesson. This asks
// the model to keep only CONTENT words (nouns, verbs, adjectives, useful everyday words)
// so lessons are built on words actually worth learning. Run once at seed time.

const BATCH_SIZE = 120;

const KEEP_SCHEMA = {
  name: 'word_decisions',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            thai: { type: 'string' },
            keep: { type: 'boolean' },
          },
          required: ['thai', 'keep'],
        },
      },
    },
    required: ['results'],
  },
};

function prompt(batch) {
  return `You are a Thai teacher choosing vocabulary for beginner lessons.
For each Thai word, decide:
- keep = true if it is a CONTENT word worth teaching: a common noun, a main verb, an
  adjective, or a useful everyday word/phrase.
- keep = false if it is a function word (particle, pronoun, preposition, conjunction,
  classifier, number, question word like "what/why"), an interjection, a proper name,
  or an English loanword written in Thai script (e.g. โอเค, ไฮ, บาย).

Words:
${batch.map((w) => `- ${w}`).join('\n')}`;
}

// Keep only content words, preserving the input order. `words` is an array of Thai strings.
export async function keepContentWords(words, { apiKey, onProgress } = {}) {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const keep = new Set();

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt(batch) }],
      response_format: { type: 'json_schema', json_schema: KEEP_SCHEMA },
    });
    const { results } = JSON.parse(completion.choices[0].message.content);
    for (const r of results) if (r.keep) keep.add(r.thai);
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, words.length), words.length, keep.size);
  }

  return words.filter((w) => keep.has(w));
}
