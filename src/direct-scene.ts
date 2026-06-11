import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';

export interface DirectSceneOptions {
  apiKey?: string;
}

// Stage 2: a script doctor rewrites flat delivery against the charisma rubric. Input and
// output are both the screenplay format, so it can be looped.
function prompt(scene: string): string {
  return `You are a warm, funny script doctor for a beginner Thai audio lesson. Rewrite the
SCREENPLAY below so it sounds like real, likeable people — keep the SAME format, the same
teaching beats, the same Thai words, and the same [CUE:] and [wait Ns] markers.

Fix delivery against this rubric:
- Praise must VARY and come in Thai first (เก่งมาก / เยี่ยมเลย / ใกล้แล้ว) then English. Never
  reuse the same praise word twice.
- Give the teacher at least one short human aside (a small joke or personal note).
- Students hesitate in their OWN words, never the canned "Hmm, let me think".
- Vary sentence length and rhythm — do not write every line the same length.
- Cut dead filler lines; every line teaches, reacts, or moves the scene.
- Keep it TIGHT. Do not pad or lengthen — if anything, shorten. The opening must be brief
  (the new Thai word should arrive within the first few lines), and names inside English
  sentences stay in English ("Mike", not Thai script), never chopping a sentence.

Hard rules: do NOT change the Thai content words being taught, do NOT fix STUDENT1's
intentional mistake, do NOT add new Thai vocabulary, do NOT switch to JSON. Return ONLY the
rewritten screenplay.

SCREENPLAY:
${scene}`;
}

export async function directScene(scene: string, { apiKey }: DirectSceneOptions = {}): Promise<string> {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt(scene) }],
  });
  return getMessageContent(completion).trim();
}
