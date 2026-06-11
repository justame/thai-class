import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';
import type { Chunk } from './types.js';

// A second pass: a native Thai teacher reviews the generated script and fixes bad Thai
// before it is voiced. The learner cannot catch errors, so this is the safety net.
//
// Important nuance: in a classroom lesson, student1's lines contain INTENTIONAL beginner
// mistakes — those must stay (just be believable, not nonsense). Only teacher/student2
// Thai must be perfectly natural.

const REVIEW_SCHEMA = {
  name: 'reviewed_lesson',
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
            speaker: { type: 'string', enum: ['teacher', 'student1', 'student2', 'cue'] },
            lang: { type: 'string', enum: ['th', 'en'] },
            text: { type: 'string' },
            pauseAfter: { type: 'number' },
          },
          required: ['speaker', 'lang', 'text', 'pauseAfter'],
        },
      },
      issuesFound: { type: 'array', items: { type: 'string' } },
    },
    required: ['chunks', 'issuesFound'],
  },
};

interface ReviewResult {
  chunks: Chunk[];
  issuesFound: string[];
}

function prompt(chunks: Chunk[]): string {
  return `You are a native Thai teacher reviewing a beginner lesson script before it is
read aloud. Fix problems, then return the FULL corrected script in the same shape
(same number of lines, same speaker/lang/pauseAfter, only "text" may change).

Be CONSERVATIVE. Only fix clear errors; do not rewrite working lines.

Fix only this:
- Teacher and student2 Thai (lang "th") that is genuinely WRONG or nonsense — make it
  natural and correct. Do not "improve" already-correct Thai.
Do NOT change politeness particles (ครับ/ค่ะ/คะ) — gender is handled separately.

Do NOT touch the teaching moment:
- student1 is a beginner who makes an intentional mistake that the teacher then corrects.
  This is the point of the lesson. NEVER turn student1's mistake into correct Thai, and
  NEVER change a teacher's correction (e.g. "ไม่ถูก") into agreement ("ถูก"). Leave the
  student1 line and the teacher's correction of it exactly as written.
- Leave speaker "cue" lines exactly as they are — they are audio markers, not speech.
- Keep the structure and order. Do not add or remove lines.

List what you fixed in issuesFound (empty array if none).

Script (JSON):
${JSON.stringify(chunks)}`;
}

export interface ReviewThaiOptions {
  apiKey?: string;
}

export interface ReviewThaiResult {
  chunks: Chunk[];
  issues: string[];
}

// Return { chunks: corrected, issues: string[] }.
export async function reviewThai(
  chunks: Chunk[],
  { apiKey }: ReviewThaiOptions = {},
): Promise<ReviewThaiResult> {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt(chunks) }],
    response_format: { type: 'json_schema', json_schema: REVIEW_SCHEMA },
  });
  const parsed = JSON.parse(getMessageContent(completion)) as ReviewResult;
  // If the reviewer dropped or added lines, trust the original structure over the review.
  if (parsed.chunks.length !== chunks.length) {
    return { chunks, issues: [`review changed line count (${chunks.length}->${parsed.chunks.length}); kept original`] };
  }
  return { chunks: parsed.chunks, issues: parsed.issuesFound ?? [] };
}
