# Lesson Charisma Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat single-call lesson generator with a prose-first pipeline (Writer → Director critic → deterministic Formatter) plus a model upgrade and a longer pause ceiling, so lessons sound warm and human instead of robotic.

**Architecture:** `generateScript()` stays the public entry but becomes an orchestrator: an LLM **Writer** produces a natural screenplay (no JSON schema), an LLM **Director** rewrites flat lines against a charisma rubric, and a **deterministic Formatter** parses the screenplay into the existing `Chunk[]`. The existing post-steps (`fixGenderParticles` → `reviewThai` → `splitMixedScriptLines` → `checkNoMixedScript`) are unchanged.

**Tech Stack:** TypeScript (NodeNext ESM, `.js` import specifiers), OpenAI SDK, Vitest. Config in `config.jsonc` with fallbacks in `src/config.ts`.

---

## File Structure

- `config.jsonc` — bump `maxPauseSeconds`, swap `openaiModel`, add `directorPasses`.
- `src/config.ts` — add `directorPasses` to `AppConfig` + defaults + export.
- `lessons/feedback-rules.md` — seed charisma one-liners (data, not code).
- `src/lessons.ts` — change the appended OUTPUT contract from JSON-chunks to screenplay.
- `src/format-scene.ts` — NEW. Deterministic screenplay → `Chunk[]` parser.
- `src/write-scene.ts` — NEW. LLM Writer: prompt → screenplay text.
- `src/direct-scene.ts` — NEW. LLM Director: screenplay → improved screenplay.
- `src/script.ts` — rewrite `generateScript` to orchestrate the three stages.
- `test/format-scene.test.ts` — NEW. Pure parser tests (the bulk of coverage).
- `test/tts-pause.test.ts` — NEW. Lock the new clamp range.
- `test/write-scene.test.ts`, `test/direct-scene.test.ts` — NEW. Prompt-content tests, OpenAI mocked.

A note on test placement: confirm where existing tests live before writing (see Task 0).

---

## Task 0: Orient (no code)

- [ ] **Step 1: Find the test directory and runner conventions**

Run: `ls test 2>/dev/null; ls tests 2>/dev/null; grep -n '"test"' package.json`
Expected: a `test/` (or `tests/`) dir with `*.test.ts` files; `"test": "vitest run"`.
Use whichever directory already exists for every new test file below. This plan assumes `test/`.

- [ ] **Step 2: Confirm how an existing test mocks OpenAI**

Run: `grep -rln "vi.mock\|openai" test 2>/dev/null tests 2>/dev/null`
Read one match. Reuse that exact mocking style in the Writer/Director tests (Tasks 6–7).
If none exists, the pattern in Task 6 below is the reference.

---

## Task 1: Raise the pause ceiling

**Files:**
- Modify: `config.jsonc` (the `maxPauseSeconds` line)
- Test: `test/tts-pause.test.ts` (create)

The recall beat needs ~5–6s; today `maxPauseSeconds: 3.0` clamps it at [src/tts.ts:53](../../../src/tts.ts#L53).

- [ ] **Step 1: Write the failing test**

Create `test/tts-pause.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MAX_PAUSE_SECONDS, MIN_PAUSE_SECONDS } from '../src/config.js';

describe('pause range', () => {
  it('allows the recall beat to reach 6 seconds', () => {
    expect(MAX_PAUSE_SECONDS).toBe(6.0);
  });

  it('keeps the minimum pause at 0.2 seconds', () => {
    expect(MIN_PAUSE_SECONDS).toBe(0.2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/tts-pause.test.ts`
Expected: FAIL — `expected 3 to be 6`.

- [ ] **Step 3: Bump the config value**

In `config.jsonc`, change the `maxPauseSeconds` line from `3.0` to `6.0`:

```jsonc
  "maxPauseSeconds": 6.0,
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/tts-pause.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add config.jsonc test/tts-pause.test.ts
git commit -m "Raise max pause to 6s for the recall beat"
```

---

## Task 2: Add the `directorPasses` config key

**Files:**
- Modify: `src/config.ts` (interface `AppConfig`, `CONFIG_DEFAULTS`, exports section)
- Modify: `config.jsonc` (add the key)
- Test: `test/tts-pause.test.ts` (extend)

`reviewsPerLesson` already exists but means *review words per lesson* — do NOT reuse it. The Director needs its own key.

- [ ] **Step 1: Write the failing test**

Append to `test/tts-pause.test.ts`:

```typescript
import { DIRECTOR_PASSES } from '../src/config.js';

describe('director config', () => {
  it('defaults to one critic pass', () => {
    expect(DIRECTOR_PASSES).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/tts-pause.test.ts`
Expected: FAIL — `DIRECTOR_PASSES` is `undefined` (import resolves to undefined).

- [ ] **Step 3: Add the field to the interface and defaults**

In `src/config.ts`, in `interface AppConfig`, add after `reviewsPerLesson`:

```typescript
  // How many Director (charisma critic) passes run over the screenplay. 0 = skip the
  // critic. Distinct from reviewsPerLesson, which counts review WORDS, not passes.
  directorPasses: number;
```

In `CONFIG_DEFAULTS`, add after `reviewsPerLesson: 1,`:

```typescript
  directorPasses: 1,
```

- [ ] **Step 4: Export it**

In `src/config.ts`, near `export const REVIEWS_PER_LESSON = CONFIG.reviewsPerLesson;`, add:

```typescript
export const DIRECTOR_PASSES = CONFIG.directorPasses;
```

- [ ] **Step 5: Add the key to config.jsonc**

In `config.jsonc`, add near `reviewsPerLesson`:

```jsonc
  "directorPasses": 1,
```

- [ ] **Step 6: Run it and watch it pass**

Run: `npx vitest run test/tts-pause.test.ts`
Expected: PASS (all three describes).

- [ ] **Step 7: Commit**

```bash
git add src/config.ts config.jsonc test/tts-pause.test.ts
git commit -m "Add directorPasses config for the charisma critic"
```

---

## Task 3: Upgrade the generation model

**Files:**
- Modify: `config.jsonc` (the `openaiModel` line)

No test — model id is environment-dependent and verified by a live call, not a unit test.

- [ ] **Step 1: Find the newest available GPT model id**

Run: `curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" | grep -o '"id": *"gpt[^"]*"' | sort -u`
Pick the newest general chat GPT model the account can call (NOT a `-realtime`, `-audio`, or embedding model). Do NOT guess an id from memory — use one that appears in this list.

- [ ] **Step 2: Set it in config.jsonc**

In `config.jsonc`, change the `openaiModel` line from `"gpt-4o"` to the chosen id, e.g.:

```jsonc
  "openaiModel": "<newest-gpt-id-from-step-1>",
```

- [ ] **Step 3: Verify the id is callable**

Run: `node -e "import('openai').then(async({default:O})=>{const c=new O();const r=await c.chat.completions.create({model:process.env.M,messages:[{role:'user',content:'say ok'}]});console.log(r.choices[0].message.content)})"` with `M=<chosen-id>` exported and `OPENAI_API_KEY` set.
Expected: prints a short reply (proves the id is live). If it errors `model_not_found`, pick another id from Step 1.

- [ ] **Step 4: Commit**

```bash
git add config.jsonc
git commit -m "Upgrade generation model off gpt-4o"
```

---

## Task 4: Seed feedback-rules.md with charisma rules

**Files:**
- Modify: `lessons/feedback-rules.md` (replace the "No rules yet" comment with rules)

These one-liners are injected into the Writer prompt by `formatFeedbackRules` ([src/lessons.ts:49](../../../src/lessons.ts#L49)), so the Writer starts warm. Keep the frontmatter and the `HOW THIS WORKS` comment; only replace the `<!-- No rules yet... -->` line.

- [ ] **Step 1: Replace the placeholder line**

In `lessons/feedback-rules.md`, replace:

```markdown
<!-- No rules yet. They get added here as feedback comes in. -->
```

with:

```markdown
- Teacher praise must VARY and come in Thai first (เก่งมาก / เยี่ยมเลย / ใกล้แล้ว) then English — never reuse the same praise word twice in one lesson.
- Give the teacher at least one short human aside per lesson (a small joke or a personal note), not only instructions.
- Students hesitate in their OWN words ("oh wait...", "is it...?"), never the canned "Hmm, let me think".
- Vary sentence length and rhythm; do not write every line the same length.
- Cut dead filler lines — every line either teaches, reacts, or moves the scene.
```

- [ ] **Step 2: Confirm it is picked up (no code yet, just a sanity read)**

Run: `npx tsc -p tsconfig.test.json --noEmit` (typecheck only; this task changed no code).
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lessons/feedback-rules.md
git commit -m "Seed feedback-rules with charisma rules"
```

---

## Task 5: Deterministic Formatter (`src/format-scene.ts`)

**Files:**
- Create: `src/format-scene.ts`
- Test: `test/format-scene.test.ts`

Parses a screenplay into `Chunk[]`. Pure, no LLM. Reuses `splitText` from [src/split-script.ts](../../../src/split-script.ts) to separate Thai from English, and the pause constants from config.

Row grammar:
- `[CUE: name]` → one cue chunk (lang `en`, pause `CUE_PAUSE_SECONDS = 0.3`).
- `SPEAKER (mood): text [wait Ns]` or `SPEAKER: text` — speaker is TEACHER/STUDENT1/STUDENT2 (case-insensitive); `(mood)` is stripped; a trailing `[wait Ns]` sets the pause.
- Blank lines, frontmatter (`---`), `<!-- ... -->` comments, and `## ...` headings are skipped.

- [ ] **Step 1: Write the failing tests**

Create `test/format-scene.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseScene } from '../src/format-scene.js';

describe('parseScene', () => {
  it('maps a speaker label to the chunk speaker', () => {
    const [c] = parseScene('TEACHER: Hello everyone.');
    expect(c.speaker).toBe('teacher');
  });

  it('strips a mood tag from the spoken text', () => {
    const [c] = parseScene('TEACHER (warm): Hello everyone.');
    expect(c.text).toBe('Hello everyone.');
  });

  it('keeps a pure English line as one chunk', () => {
    const chunks = parseScene('TEACHER: I want food in Thai.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].lang).toBe('en');
  });

  it('splits a Thai word out of an English line into its own th chunk', () => {
    const chunks = parseScene('TEACHER: The word is อาหาร today.');
    const langs = chunks.map((c) => c.lang);
    expect(langs).toContain('th');
    expect(langs).toContain('en');
    const thai = chunks.find((c) => c.lang === 'th');
    expect(thai?.text).toBe('อาหาร');
  });

  it('turns a CUE row into a cue chunk', () => {
    const [c] = parseScene('[CUE: new_word]');
    expect(c.speaker).toBe('cue');
    expect(c.text).toBe('new_word');
    expect(c.pauseAfter).toBe(0.3);
  });

  it('applies a wait hint to the last piece of the row', () => {
    const chunks = parseScene('TEACHER: How do you say it? [wait 5s]');
    expect(chunks[chunks.length - 1].pauseAfter).toBe(5);
  });

  it('clamps a wait hint above the ceiling to 6 seconds', () => {
    const chunks = parseScene('TEACHER: Take your time. [wait 99s]');
    expect(chunks[chunks.length - 1].pauseAfter).toBe(6);
  });

  it('gives non-final pieces of one row a short intra-line pause', () => {
    const chunks = parseScene('TEACHER: The word อาหาร means food. [wait 4s]');
    // first piece (English "The word") is not the last piece of the row
    expect(chunks[0].pauseAfter).toBe(0.2);
  });

  it('skips frontmatter, comments and headings', () => {
    const chunks = parseScene('---\ntitle: x\n---\n<!-- note -->\n## Words\nTEACHER: Hi.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Hi.');
  });

  it('throws on a person row with empty text', () => {
    expect(() => parseScene('TEACHER (warm):   ')).toThrow();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/format-scene.test.ts`
Expected: FAIL — `parseScene` is not defined / module not found.

- [ ] **Step 3: Write the Formatter**

Create `src/format-scene.ts`:

```typescript
import { MIN_PAUSE_SECONDS, MAX_PAUSE_SECONDS, DEFAULT_PAUSE_SECONDS } from './config.js';
import { splitText } from './split-script.js';
import type { Chunk, Speaker } from './types.js';

// Turns a screenplay (one spoken line per row) into ordered chunks for the audio step.
// Deterministic: no model call. The Writer/Director own the words and the pacing (via
// [wait Ns] hints); this only reshapes their text into the chunk contract the TTS needs.
//
// Row grammar:
//   [CUE: name]                         -> a cue chunk (audio marker, not speech)
//   SPEAKER (mood): text [wait Ns]      -> one or more chunks, Thai split from English
//   SPEAKER: text                       -> mood and wait are optional
// Frontmatter, <!-- comments -->, ## headings and blank lines are skipped.

const CUE_PAUSE_SECONDS = 0.3;

const SPEAKER_BY_LABEL: Record<string, Speaker> = {
  TEACHER: 'teacher',
  STUDENT1: 'student1',
  STUDENT2: 'student2',
};

const CUE_ROW = /^\[CUE:\s*(\w+)\s*\]$/i;
const PERSON_ROW = /^(\w+)\s*(?:\([^)]*\))?\s*:\s*(.*)$/;
const WAIT_HINT = /\s*\[wait\s+([\d.]+)s?\]\s*$/i;

function clampPause(seconds: number): number {
  return Math.min(MAX_PAUSE_SECONDS, Math.max(MIN_PAUSE_SECONDS, seconds));
}

function isSkippable(line: string): boolean {
  return line === '' || line === '---' || line.startsWith('<!--') || line.startsWith('##');
}

// Pull a trailing "[wait Ns]" off the text. Returns the cleaned text and the wait (or null).
function takeWait(text: string): { text: string; wait: number | null } {
  const m = text.match(WAIT_HINT);
  if (!m) return { text: text.trim(), wait: null };
  return { text: text.replace(WAIT_HINT, '').trim(), wait: Number(m[1]) };
}

function cueChunk(name: string): Chunk {
  return { speaker: 'cue', lang: 'en', text: name, pauseAfter: CUE_PAUSE_SECONDS };
}

// One screenplay row -> the chunks it produces. The row's pause (wait hint, or the lang
// default) lands on the LAST piece; earlier pieces get a short intra-line beat so a single
// sentence is not glued together with no breath but also is not a long dead gap mid-line.
function personChunks(speaker: Speaker, rawText: string): Chunk[] {
  const { text, wait } = takeWait(rawText);
  if (!text) throw new Error(`Empty spoken line for ${speaker}`);
  const pieces = splitText(text);
  if (pieces.length === 0) throw new Error(`No speakable content for ${speaker}: "${rawText}"`);
  const endPause = clampPause(wait ?? DEFAULT_PAUSE_SECONDS);
  return pieces.map((piece, i) => ({
    speaker,
    lang: piece.lang,
    text: piece.text,
    pauseAfter: i === pieces.length - 1 ? endPause : MIN_PAUSE_SECONDS,
  }));
}

export function parseScene(screenplay: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const raw of screenplay.split('\n')) {
    const line = raw.trim();
    if (isSkippable(line)) continue;

    const cue = line.match(CUE_ROW);
    if (cue) {
      chunks.push(cueChunk(cue[1].toLowerCase()));
      continue;
    }

    const person = line.match(PERSON_ROW);
    if (!person) continue; // narration / unknown row: not speakable, skip
    const speaker = SPEAKER_BY_LABEL[person[1].toUpperCase()];
    if (!speaker) continue; // a word with a colon that is not a speaker label
    chunks.push(...personChunks(speaker, person[2]));
  }
  if (chunks.length === 0) throw new Error('Screenplay produced no chunks');
  return chunks;
}
```

> NOTE: `splitText` is imported from `split-script.ts` and is the SAME splitter the audio guard uses, so the Formatter and the safety net agree on where Thai ends and English begins.

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run test/format-scene.test.ts`
Expected: PASS (all cases). If "skips frontmatter" fails because `splitText` keeps `title: x`, confirm the heading/comment/`---` lines are caught by `isSkippable` before `PERSON_ROW` — `title: x` has no known speaker label so it is skipped by the `!speaker` guard.

- [ ] **Step 5: Verify `DEFAULT_PAUSE_SECONDS` is exported**

Run: `grep -n "export const DEFAULT_PAUSE_SECONDS\|export const MIN_PAUSE_SECONDS\|export const MAX_PAUSE_SECONDS" src/config.ts`
Expected: all three are exported (they are, per current config.ts). If any is missing, add the export.

- [ ] **Step 6: Commit**

```bash
git add src/format-scene.ts test/format-scene.test.ts
git commit -m "Add deterministic screenplay-to-chunks formatter"
```

---

## Task 6: Change the lesson prompt's output contract to screenplay

**Files:**
- Modify: `src/lessons.ts` (the OUTPUT FORMAT block in `buildLessonPrompt`, [src/lessons.ts:106-116](../../../src/lessons.ts#L106-L116))
- Test: `test/lessons-contract.test.ts` (create)

The Writer must emit a screenplay, not JSON chunks. Replace the chunk/JSON contract appended in `buildLessonPrompt` with the screenplay contract.

- [ ] **Step 1: Write the failing test**

Create `test/lessons-contract.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildLessonPrompt } from '../src/lessons.js';

const WORD = { id: 'w1', thai: 'อาหาร', english: 'food', exampleSentences: [] } as const;

describe('buildLessonPrompt output contract', () => {
  it('asks for a screenplay, not JSON chunks', async () => {
    const prompt = await buildLessonPrompt('classroom', [WORD as any], []);
    expect(prompt).toContain('SCREENPLAY');
    expect(prompt).toContain('[CUE:');
    expect(prompt).not.toContain('json_schema');
    expect(prompt).not.toContain('pauseAfter');
  });

  it('explains the [wait Ns] pause hint', async () => {
    const prompt = await buildLessonPrompt('classroom', [WORD as any], []);
    expect(prompt).toContain('[wait');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/lessons-contract.test.ts`
Expected: FAIL — the current prompt contains `pauseAfter` and an `OUTPUT FORMAT` chunk contract, not `SCREENPLAY`.

- [ ] **Step 3: Replace the OUTPUT FORMAT block**

In `src/lessons.ts`, in `buildLessonPrompt`, replace the returned template's trailing block (everything from `OUTPUT FORMAT (always follow this exactly):` to the end of the template string) with:

```typescript
SCREENPLAY FORMAT (always follow this exactly):
Write the lesson as a screenplay — one spoken line per row, in the order it is heard.
- Each row is "SPEAKER: text" or "SPEAKER (mood): text". SPEAKER is one of TEACHER,
  STUDENT1, STUDENT2. The (mood) is an optional delivery hint and is not spoken.
- Keep Thai in Thai script, inline in the line. Write the English parts in English.
  An English sentence stays on ONE row — do not chop it into fragments.
- Audio cues are their own row written as "[CUE: name]" where name is one of:
  start, new_word, try, correct, practice, recap.
- To leave silence for the listener to answer or repeat, end a row with "[wait Ns]"
  (seconds), e.g. a recall question "How do you say ...? [wait 5s]". Use a long wait
  (5-6s) when the listener must produce a full phrase, ~2s right after a Thai word to
  repeat. Do not add [wait] to ordinary lines.
- No JSON. No stage directions other than the (mood) tag and [CUE:]/[wait] markers.`;
```

(The line restating `TODAY'S ACTUAL WORDS` stays exactly as it is, above this block.)

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/lessons-contract.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/lessons.ts test/lessons-contract.test.ts
git commit -m "Switch lesson prompt output contract to screenplay"
```

---

## Task 7: Writer stage (`src/write-scene.ts`)

**Files:**
- Create: `src/write-scene.ts`
- Test: `test/write-scene.test.ts`

Thin LLM wrapper: takes the lesson prompt, returns screenplay TEXT (no JSON schema — free-form so the model writes a scene).

- [ ] **Step 1: Write the failing test (OpenAI mocked at the boundary)**

Create `test/write-scene.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const create = vi.fn(async () => ({
  choices: [{ message: { content: 'TEACHER: Hello.' } }],
}));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create } }; },
}));

import { writeScene } from '../src/write-scene.js';

describe('writeScene', () => {
  it('returns the model screenplay text', async () => {
    const out = await writeScene('LESSON PROMPT', { apiKey: 'k' });
    expect(out).toBe('TEACHER: Hello.');
  });

  it('sends the lesson prompt to the model', async () => {
    await writeScene('LESSON PROMPT', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toContain('LESSON PROMPT');
  });

  it('does not request a json_schema response', async () => {
    await writeScene('LESSON PROMPT', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.response_format).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/write-scene.test.ts`
Expected: FAIL — module not found / `writeScene` undefined.

- [ ] **Step 3: Write the Writer**

Create `src/write-scene.ts`:

```typescript
import OpenAI from 'openai';
import { OPENAI_MODEL } from './config.js';
import { getMessageContent } from './llm.js';

export interface WriteSceneOptions {
  apiKey?: string;
}

// Stage 1 of generation: turn the lesson instructions into a natural screenplay. No JSON
// schema on purpose — a free-form scene reads warmer than a model filling a rigid form.
export async function writeScene(prompt: string, { apiKey }: WriteSceneOptions = {}): Promise<string> {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return getMessageContent(completion).trim();
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/write-scene.test.ts`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add src/write-scene.ts test/write-scene.test.ts
git commit -m "Add Writer stage: prompt to screenplay"
```

---

## Task 8: Director stage (`src/direct-scene.ts`)

**Files:**
- Create: `src/direct-scene.ts`
- Test: `test/direct-scene.test.ts`

LLM critic: takes a screenplay, returns an improved screenplay (same format). Carries the charisma rubric in its prompt.

- [ ] **Step 1: Write the failing test**

Create `test/direct-scene.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const create = vi.fn(async () => ({
  choices: [{ message: { content: 'TEACHER (warm): เยี่ยมเลย! Great.' } }],
}));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create } }; },
}));

import { directScene } from '../src/direct-scene.js';

describe('directScene', () => {
  it('returns the improved screenplay text', async () => {
    const out = await directScene('TEACHER: good job.', { apiKey: 'k' });
    expect(out).toBe('TEACHER (warm): เยี่ยมเลย! Great.');
  });

  it('puts the original screenplay in the prompt', async () => {
    await directScene('TEACHER: good job.', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toContain('TEACHER: good job.');
  });

  it('carries the charisma rubric (varied Thai praise)', async () => {
    await directScene('TEACHER: good job.', { apiKey: 'k' });
    const arg = create.mock.calls.at(-1)![0];
    expect(arg.messages[0].content).toMatch(/praise/i);
    expect(arg.messages[0].content).toContain('SCREENPLAY');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/direct-scene.test.ts`
Expected: FAIL — module not found / `directScene` undefined.

- [ ] **Step 3: Write the Director**

Create `src/direct-scene.ts`:

```typescript
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
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/direct-scene.test.ts`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add src/direct-scene.ts test/direct-scene.test.ts
git commit -m "Add Director stage: charisma critic pass"
```

---

## Task 9: Wire the three stages into `generateScript`

**Files:**
- Modify: `src/script.ts` (`generateScript`, drop `LESSON_SCHEMA` + the direct JSON call)
- Test: `test/generate-script.test.ts` (create)

`generateScript` keeps its signature so `scripts/text.ts` is untouched. New flow: writeScene → directScene ×`DIRECTOR_PASSES` → parseScene → fixGenderParticles → reviewThai → splitMixedScriptLines → checkNoMixedScript.

- [ ] **Step 1: Write the failing test (all LLM stages mocked)**

Create `test/generate-script.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/write-scene.js', () => ({
  writeScene: vi.fn(async () => '[CUE: start]\nTEACHER: The word is อาหาร.'),
}));
const directScene = vi.fn(async (s: string) => s);
vi.mock('../src/direct-scene.js', () => ({ directScene }));
vi.mock('../src/verify.js', () => ({
  reviewThai: vi.fn(async (chunks: any) => ({ chunks, issues: [] })),
}));

import { generateScript } from '../src/script.js';

const WORD = { id: 'w1', thai: 'อาหาร', english: 'food', exampleSentences: [] };

describe('generateScript', () => {
  it('produces chunks from the screenplay', async () => {
    const chunks = await generateScript([WORD as any], [], { lessonType: 'classroom' });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.speaker === 'cue' && c.text === 'start')).toBe(true);
    expect(chunks.some((c) => c.lang === 'th' && c.text === 'อาหาร')).toBe(true);
  });

  it('runs the Director DIRECTOR_PASSES times', async () => {
    directScene.mockClear();
    await generateScript([WORD as any], [], { lessonType: 'classroom' });
    expect(directScene).toHaveBeenCalledTimes(1); // default directorPasses = 1
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/generate-script.test.ts`
Expected: FAIL — `generateScript` still calls the old JSON path / does not import the new stages.

- [ ] **Step 3: Rewrite `generateScript`**

In `src/script.ts`: remove `LESSON_SCHEMA` and the `client.chat.completions.create({ ... json_schema ... })` block. Update imports and the function body. The new file body (imports + function) reads:

```typescript
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
```

> NOTE: the old in-file `LESSON_SCHEMA` and the import of `OpenAI`/`OPENAI_MODEL`/`getMessageContent` are gone from `script.ts` — those now live only in `write-scene.ts` / `direct-scene.ts`. Remove any now-unused imports so `tsc` does not error.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/generate-script.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck the whole project**

Run: `npx tsc -p tsconfig.test.json --noEmit`
Expected: no errors. Fix any unused-import or type errors revealed by the rewrite.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all green. If a pre-existing test imported `LESSON_SCHEMA` from `script.ts`, update it to the new reality (it is no longer exported). Report any failure you did not cause rather than weakening its assertion.

- [ ] **Step 7: Commit**

```bash
git add src/script.ts test/generate-script.test.ts
git commit -m "Orchestrate writer, director, formatter in generateScript"
```

---

## Task 10: Manual ear check (the real quality gate)

**Files:** none (manual run). Requires `OPENAI_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS` in `.env`.

Charisma is not unit-testable — this is where it is judged.

- [ ] **Step 1: Generate the same word as ep-4 for an A/B compare**

Run: `npm run text -- --word=อาหาร`
Expected: prints a lesson number and writes `episodes/ep-N/transcript.md`. Read it: praise should vary and be Thai-first, the teacher should have a human aside, the recall line should carry a long wait, English sentences should be whole (not fragments).

- [ ] **Step 2: Voice it**

Run: `npm run audio -- N` (use the number from Step 1)
Expected: writes `episodes/ep-N/lesson.mp3` (also `build/lesson.mp3`).
Do NOT auto-play it (per project rule — just report the path).

- [ ] **Step 3: Listen and compare to ep-4**

Give the user the mp3 path. Ask: warmer? less choppy? real pause to answer? If still flat, the next lever is raising `directorPasses` to 2 in `config.jsonc` or sharpening the rubric in `direct-scene.ts` — do that and re-run Step 1–2.

- [ ] **Step 4: Commit any transcript/config tuning**

```bash
git add -A
git commit -m "Tune charisma pipeline after ear check"
```

---

## Self-Review Notes (author)

- **Spec coverage:** 3-stage pipeline (Tasks 5,7,8,9) ✓; model upgrade (Task 3) ✓; feedback-rules seed (Task 4) ✓; screenplay format + rubric (Tasks 6,8) ✓; pause plan + 6s ceiling (Tasks 1,5) ✓; `directorPasses` (Task 2) ✓; tests incl. deterministic formatter + mocked LLM stages (Tasks 5–9) ✓; ear check + known limits (Task 10) ✓.
- **Open risk:** `parseScene` skipping behavior depends on `splitText` not throwing on odd rows; Task 5 Step 4 calls this out. If the model emits narration lines without a `SPEAKER:` they are silently skipped — acceptable, but watch for dropped content during the ear check.
