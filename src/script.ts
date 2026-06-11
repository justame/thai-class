import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';
import { buildLessonPrompt } from './lessons.js';
import { reviewThai } from './verify.js';
import { fixGenderParticles } from './particles.js';
import { checkNoMixedScript } from './script-check.js';
import { splitMixedScriptLines } from './split-script.js';
import type { Chunk, Word } from './types.js';

// The lesson is returned as ordered chunks. Each chunk is one language so the audio
// step can read Thai with a Thai voice and English with an English voice later. v1
// uses one voice, but the structure is kept so that upgrade changes only tts.ts.
//
// The lesson's teaching instructions come from an editable markdown skill in lessons/
// (chosen by data/lesson-plan.json). This file only enforces the OUTPUT shape (chunks),
// so editing a lesson markdown changes the teaching but never breaks the audio pipeline.
//
// NOTE: An LLM can produce subtly wrong Thai (wrong tone mark, unnatural phrasing) and
// the learner cannot catch it. We reduce this by only ever passing real words from the
// vocab list — the model writes *around* them, it never invents vocabulary.

// "cue" is not a person — it marks a short audio cue (text holds the cue name).
const SPEAKERS = ['teacher', 'student1', 'student2', 'cue'];

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
            speaker: { type: 'string', enum: SPEAKERS },
            lang: { type: 'string', enum: ['th', 'en'] },
            // For a person: the spoken line. For speaker "cue": the cue name (start/new_word/practice/recap).
            text: { type: 'string' },
            // Seconds of silence after this line; use a longer value to let the listener repeat.
            pauseAfter: { type: 'number' },
          },
          required: ['speaker', 'lang', 'text', 'pauseAfter'],
        },
      },
    },
    required: ['chunks'],
  },
};

// Guard against an empty or malformed result even though the schema is strict.
function checkChunks(chunks: Chunk[]): Chunk[] {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('LLM returned no lesson chunks');
  }
  for (const c of chunks) {
    if (!c.text || !c.text.trim()) throw new Error('LLM returned an empty chunk');
  }
  return chunks;
}

export interface GenerateScriptOptions {
  apiKey?: string;
  lessonType?: string;
  verify?: boolean;
}

export async function generateScript(
  newWords: Word[],
  reviewWords: Word[],
  { apiKey, lessonType = 'micro', verify = true }: GenerateScriptOptions = {},
): Promise<Chunk[]> {
  const prompt = await buildLessonPrompt(lessonType, newWords, reviewWords);
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_schema', json_schema: LESSON_SCHEMA },
  });
  const parsed = JSON.parse(getMessageContent(completion)) as { chunks: Chunk[] };
  const chunks = checkChunks(parsed.chunks);

  // Gender particles are fixed deterministically by speaker (not by the LLM).
  const gendered = fixGenderParticles(chunks);

  // Second pass: a native Thai teacher fixes any bad/unnatural Thai before it is voiced.
  if (!verify) return checkNoMixedScript(splitMixedScriptLines(gendered));
  const { chunks: reviewed, issues } = await reviewThai(gendered, { apiKey });
  if (issues.length) console.log(`Thai review fixed: ${issues.join('; ')}`);
  // Any Thai left in an English line is split into its own Thai-voice chunk so it is
  // HEARD in the Thai voice, never romanized into the English voice.
  const clean = splitMixedScriptLines(fixGenderParticles(checkChunks(reviewed)));
  return checkNoMixedScript(clean);
}

export { checkChunks, SPEAKERS };
