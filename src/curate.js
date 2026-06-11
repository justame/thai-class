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

const OBVIOUS_SCHEMA = {
  name: 'obvious_decisions',
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
            obvious: { type: 'boolean' },
          },
          required: ['thai', 'obvious'],
        },
      },
    },
    required: ['results'],
  },
};

function obviousPrompt(batch) {
  return `You are a Thai teacher planning lessons for an English-speaking learner who has
spent time around Thai speakers and knows the tourist basics.
For each Thai word, decide:
- obvious = true if the learner almost certainly knows it BEFORE any lesson: the first
  words every visitor picks up (hello, thank you, yes, no, go, eat, delicious, water,
  polite particles, numbers one to ten), or an English loanword written in Thai script.
- obvious = false if a beginner would still need to be taught it.

When unsure, answer false — wrongly skipping a useful word costs more than teaching
an easy one.

Words:
${batch.map((w) => `- ${w}`).join('\n')}`;
}

// A word needs tagging until it has an explicit obvious boolean. Tagged-false words
// stay distinguishable from never-tagged ones, so re-runs only pay for new words.
export function needsObviousTag(word) {
  return typeof word.obvious !== 'boolean';
}

// Tag each word object with obvious=true/false. The judgment comes from the LLM once
// and is stored as data in vocab.json (hand-editable); selection stays deterministic
// (see srs.js getNewWords). Already-tagged words are returned as-is.
export async function tagObviousWords(words, { apiKey, onProgress } = {}) {
  const missing = words.filter(needsObviousTag);
  if (missing.length === 0) return words;

  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const byThai = new Map();

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE).map((w) => w.thai);
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: obviousPrompt(batch) }],
      response_format: { type: 'json_schema', json_schema: OBVIOUS_SCHEMA },
    });
    const { results } = JSON.parse(completion.choices[0].message.content);
    for (const r of results) byThai.set(r.thai, r.obvious);
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, missing.length), missing.length);
  }

  return words.map((w) => {
    if (!needsObviousTag(w)) return w;
    const obvious = byThai.get(w.thai);
    if (typeof obvious !== 'boolean') throw new Error(`No obvious decision for "${w.thai}"`);
    return { ...w, obvious };
  });
}
