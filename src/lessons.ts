import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './config.js';
import type { LessonPlan, Word } from './types.js';

// Lesson types are editable markdown "skills" in lessons/. Each file has frontmatter
// (name, description) and a body that is the instruction template sent to the LLM, with
// {{NEW_WORDS}} and {{REVIEW_WORDS}} placeholders. To change how lessons are taught,
// edit the markdown — no code change. The output chunk format (lang/role) is still
// enforced in code (script.ts), so a markdown edit can change the teaching but cannot
// break the audio pipeline.

const LESSONS_DIR = join(PATHS.root, 'lessons');
const PLAN_PATH = join(PATHS.root, 'data', 'lesson-plan.json');
const DEFAULT_TYPE = 'micro';

export interface Frontmatter {
  meta: Record<string, string>;
  body: string;
}

// Split "---\n<frontmatter>\n---\n<body>" into { meta, body }.
export function parseFrontmatter(text: string): Frontmatter {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

function formatWords(words: Word[]): string {
  if (!words.length) return '(none)';
  return words
    .map((w) => {
      const ex = w.exampleSentences?.length ? ` (example: ${w.exampleSentences[0]})` : '';
      return `- ${w.thai} = ${w.english}${ex}`;
    })
    .join('\n');
}

export async function listLessonTypes(): Promise<string[]> {
  const files = await readdir(LESSONS_DIR);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

export async function loadLessonPlan(): Promise<LessonPlan> {
  if (!existsSync(PLAN_PATH)) return { mode: 'fixed', type: DEFAULT_TYPE };
  return JSON.parse(await readFile(PLAN_PATH, 'utf8')) as LessonPlan;
}

// Decide which lesson type runs. "fixed" always uses plan.type. "rotate" steps through
// plan.rotation by episode number (deterministic — no randomness).
export function chooseLessonType(plan: LessonPlan, episodeNumber: number): string {
  if (plan.mode === 'rotate' && Array.isArray(plan.rotation) && plan.rotation.length) {
    return plan.rotation[(episodeNumber - 1) % plan.rotation.length];
  }
  return plan.type ?? DEFAULT_TYPE;
}

// Build the final prompt for a lesson type by filling its template with the words.
export async function buildLessonPrompt(
  lessonType: string,
  newWords: Word[],
  reviewWords: Word[],
): Promise<string> {
  const path = join(LESSONS_DIR, `${lessonType}.md`);
  if (!existsSync(path)) throw new Error(`Lesson type "${lessonType}" not found at ${path}`);
  const { body } = parseFrontmatter(await readFile(path, 'utf8'));
  const filled = body
    .replace('{{NEW_WORDS}}', formatWords(newWords))
    .replace('{{REVIEW_WORDS}}', formatWords(reviewWords));

  // Append the fixed output contract plus an explicit restatement of the real words.
  // The restatement comes LAST (most salient) and guards against the model copying any
  // example words that appear inside the lesson instructions.
  return `${filled}

TODAY'S ACTUAL WORDS — teach ONLY these:
- NEW: ${newWords.map((w) => `${w.thai} (${w.english})`).join(', ') || '(none)'}
- REVIEW: ${reviewWords.map((w) => `${w.thai} (${w.english})`).join(', ') || '(none)'}
Any other Thai words shown above are only format examples — do NOT teach them.

OUTPUT FORMAT (always follow this exactly):
Return ordered chunks. Each chunk is ONE line by ONE speaker in ONE language:
- speaker: "teacher", "student1", "student2", or "cue". For a single-narrator lesson, use
  "teacher" for every spoken chunk. A "cue" chunk is a short audio marker, not speech —
  its text is one of: start, new_word, try, correct, practice, recap (lang "en", pauseAfter 0.3).
- lang: "th" for Thai text, "en" for English text. Never mix scripts in one chunk —
  split a Thai word inside an English sentence into separate chunks.
- text: the spoken line (no stage directions, no "[pause]" markers).
- pauseAfter: seconds of silence after this line. Use 0.7 normally; use 1.5-2.0 right
  after a Thai word the listener should repeat.`;
}

export { formatWords };
