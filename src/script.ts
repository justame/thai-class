import { DIRECTOR_PASSES } from './config.js';
import { buildLessonPrompt } from './lessons.js';
import { writeScene } from './write-scene.js';
import { directScene } from './direct-scene.js';
import { parseScene } from './format-scene.js';
import { reviewThai } from './verify.js';
import { checkNoMixedScript } from './script-check.js';
import { splitMixedScriptLines } from './split-script.js';
import type { Chunk, Word } from './types.js';

// "cue" is not a person — it marks a short audio cue (text holds the cue name).
const SPEAKERS = ['teacher', 'student1', 'student2', 'cue'];

// Seconds elapsed since a start time, for the stage timing logs below. The three LLM
// stages run in series, so these numbers show exactly where generation spends its time.
function secondsSince(startMs: number): string {
  return `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
}

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
  const totalStart = Date.now();
  const prompt = await buildLessonPrompt(lessonType, newWords, reviewWords);

  console.log('[timing] writer: started...');
  let stageStart = Date.now();
  let scene = await writeScene(prompt, { apiKey });
  console.log(`[timing] writer: done in ${secondsSince(stageStart)}`);

  console.log(`[timing] director (${DIRECTOR_PASSES} pass): started...`);
  stageStart = Date.now();
  for (let i = 0; i < DIRECTOR_PASSES; i += 1) {
    scene = await directScene(scene, { apiKey });
  }
  console.log(`[timing] director (${DIRECTOR_PASSES} pass): done in ${secondsSince(stageStart)}`);

  const chunks = checkChunks(parseScene(scene));

  // Gender particles (ครับ/ค่ะ/คะ) are NOT fixed by a deterministic rule: whether a line
  // ends ครับ or ค่ะ depends on who it is spoken AS, not who speaks it — a female teacher
  // modeling a male line correctly uses ครับ. A blind speaker-gender rewrite taught the
  // OPPOSITE (ep-5: "male = ค่ะ"). Particle correctness is left to the model and verified
  // by reviewThai, which has the surrounding English context to judge it.
  if (!verify) return checkNoMixedScript(splitMixedScriptLines(chunks));

  console.log('[timing] reviewThai: started...');
  stageStart = Date.now();
  const { chunks: reviewed, issues } = await reviewThai(chunks, { apiKey });
  console.log(`[timing] reviewThai: done in ${secondsSince(stageStart)}`);
  if (issues.length) console.log(`Thai review fixed: ${issues.join('; ')}`);

  const clean = splitMixedScriptLines(checkChunks(reviewed));
  console.log(`[timing] generateScript total: ${secondsSince(totalStart)}`);
  return checkNoMixedScript(clean);
}

export { checkChunks, SPEAKERS };
