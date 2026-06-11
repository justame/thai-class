import { DIRECTOR_PASSES } from './config.js';
import { buildLessonPrompt } from './lessons.js';
import { writeScene } from './write-scene.js';
import { directScene } from './direct-scene.js';
import { parseScene } from './format-scene.js';
import { reviewThai } from './verify.js';
import { fixGenderParticles } from './particles.js';
import { checkNoMixedScript } from './script-check.js';
import { splitMixedScriptLines } from './split-script.js';
import type { Chunk, Word } from './types.js';

// "cue" is not a person — it marks a short audio cue (text holds the cue name).
const SPEAKERS = ['teacher', 'student1', 'student2', 'cue'];

// Guard against an empty or malformed result.
function checkChunks(chunks: Chunk[]): Chunk[] {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('No lesson chunks');
  }
  for (const c of chunks) {
    if (!c.text || !c.text.trim()) throw new Error('Empty chunk');
  }
  return chunks;
}

export interface GenerateScriptOptions {
  apiKey?: string;
  lessonType?: string;
  verify?: boolean;
}

// The lesson is written as a natural screenplay (Writer), polished for warmth (Director),
// then turned into chunks (Formatter). Keeping the screenplay as the human-authored layer
// and the chunks as the machine layer is why the audio sounds like people, not a form.
export async function generateScript(
  newWords: Word[],
  reviewWords: Word[],
  { apiKey, lessonType = 'micro', verify = true }: GenerateScriptOptions = {},
): Promise<Chunk[]> {
  const prompt = await buildLessonPrompt(lessonType, newWords, reviewWords);
  let scene = await writeScene(prompt, { apiKey });
  for (let i = 0; i < DIRECTOR_PASSES; i += 1) {
    scene = await directScene(scene, { apiKey });
  }
  const chunks = checkChunks(parseScene(scene));

  // Gender particles are fixed deterministically by speaker (not by the LLM).
  const gendered = fixGenderParticles(chunks);

  // Native-Thai correctness pass before voicing (student1's intentional mistake is preserved).
  if (!verify) return checkNoMixedScript(splitMixedScriptLines(gendered));
  const { chunks: reviewed, issues } = await reviewThai(gendered, { apiKey });
  if (issues.length) console.log(`Thai review fixed: ${issues.join('; ')}`);
  const clean = splitMixedScriptLines(fixGenderParticles(checkChunks(reviewed)));
  return checkNoMixedScript(clean);
}

export { checkChunks, SPEAKERS };
