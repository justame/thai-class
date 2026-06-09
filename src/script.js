import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';

// The lesson is returned as ordered chunks. Each chunk is one language so the audio
// step can read Thai with a Thai voice and English with an English voice later. v1
// uses one voice, but the structure is kept so that upgrade changes only tts.js.
//
// NOTE: An LLM can produce subtly wrong Thai (wrong tone mark, unnatural phrasing) and
// the learner cannot catch it. We reduce this by (a) only ever passing real words from
// the vocab list — the model writes *around* them, it never invents vocabulary — and
// (b) reusing dataset example sentences when a word already has them. Sentences are
// kept short on purpose.

const CHUNK_ROLES = ['opening', 'explain', 'example', 'review', 'recap'];

const LESSON_SCHEMA = {
  name: 'thai_lesson',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      chunks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            lang: { type: 'string', enum: ['th', 'en'] },
            text: { type: 'string' },
            role: { type: 'string', enum: CHUNK_ROLES },
          },
          required: ['lang', 'text', 'role'],
        },
      },
    },
    required: ['chunks'],
  },
};

function buildPrompt(newWords, reviewWords) {
  const fmt = (w) => {
    const ex = w.exampleSentences?.length ? ` (example: ${w.exampleSentences[0]})` : '';
    return `- ${w.thai} = ${w.english}${ex}`;
  };
  const newList = newWords.map(fmt).join('\n') || '(none)';
  const reviewList = reviewWords.map(fmt).join('\n') || '(none)';

  return `You write a short spoken Thai lesson for a beginner/intermediate learner.
Target length: 45-90 seconds when read aloud (roughly 90-150 words total).

NEW words to teach today:
${newList}

REVIEW words to weave in naturally (already seen before):
${reviewList}

Rules:
- Use ONLY the Thai words listed above as the vocabulary being taught. Do not introduce
  other new vocabulary to learn. You may use very common connector words to form sentences.
- Natural, real-world Thai. Short sentences. No textbook stiffness.
- For each new word: a Thai example sentence, then a short English explanation.
- Weave each review word into a natural sentence.
- End with a quick recap listing each word = meaning.
- If a word already has an example sentence above, prefer reusing it.

Output ordered chunks. Each chunk is ONE language only:
- lang "th" for Thai text, lang "en" for English text.
- role one of: opening, explain, example, review, recap.
Keep Thai and English in separate chunks (never mix scripts in one chunk).`;
}

// Guard against an empty or malformed result even though the schema is strict.
function checkChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('LLM returned no lesson chunks');
  }
  for (const c of chunks) {
    if (!c.text || !c.text.trim()) throw new Error('LLM returned an empty chunk');
  }
  return chunks;
}

export async function generateScript(newWords, reviewWords, { apiKey } = {}) {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: buildPrompt(newWords, reviewWords) }],
    response_format: { type: 'json_schema', json_schema: LESSON_SCHEMA },
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  return checkChunks(parsed.chunks);
}

export { buildPrompt, checkChunks, CHUNK_ROLES };
