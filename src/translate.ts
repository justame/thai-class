import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';
import type { Word } from './types.js';

// Words are seeded Thai-only. The first time a word is chosen for a lesson, we translate
// it here and the result is saved back to vocab.json (so each word is translated once,
// ever). Only words actually used get translated — a few per day, not thousands.
//
// NOTE: These are LLM translations the learner cannot verify. For common words (we go in
// frequency order) errors are rare, but they are possible. The English shows in the
// episode description, so a wrong gloss is at least visible and editable in vocab.json.

const TRANSLATION_SCHEMA = {
  name: 'translations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      translations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            thai: { type: 'string' },
            english: { type: 'string' },
          },
          required: ['thai', 'english'],
        },
      },
    },
    required: ['translations'],
  },
};

interface TranslationResult {
  translations: { thai: string; english: string }[];
}

function needsTranslation(word: Word): boolean {
  return !word.english || !word.english.trim();
}

export interface AddTranslationsOptions {
  apiKey?: string;
}

// Return the words with english filled in. Untouched words are returned as-is.
export async function addTranslations(
  words: Word[],
  { apiKey }: AddTranslationsOptions = {},
): Promise<Word[]> {
  const missing = words.filter(needsTranslation);
  if (missing.length === 0) return words;

  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const prompt = `Translate each Thai word to a short, natural English meaning (1-4 words).
Return the meaning only — no notes, no transliteration.

Thai words:
${missing.map((w) => `- ${w.thai}`).join('\n')}`;

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_schema', json_schema: TRANSLATION_SCHEMA },
  });
  const { translations } = JSON.parse(getMessageContent(completion)) as TranslationResult;
  const byThai = new Map(translations.map((t) => [t.thai, t.english]));

  return words.map((w) => {
    if (!needsTranslation(w)) return w;
    const english = byThai.get(w.thai);
    if (!english || !english.trim()) {
      throw new Error(`No translation returned for "${w.thai}"`);
    }
    return { ...w, english };
  });
}

export { needsTranslation };
