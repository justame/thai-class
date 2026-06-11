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

// Short beat between the pieces of ONE spoken line (e.g. an English fragment then a Thai
// word). Distinct from MIN_PAUSE_SECONDS, which is the clamp floor — they may differ later.
const INTRA_LINE_PAUSE_SECONDS = 0.2;

const SPEAKER_BY_LABEL: Record<string, Speaker> = {
  TEACHER: 'teacher',
  STUDENT1: 'student1',
  STUDENT2: 'student2',
};

const CUE_ROW = /^\[CUE:\s*(\w+)\s*\]$/i;
const PERSON_ROW = /^(\w+)\s*(?:\([^)]*\))?\s*:\s*(.*)$/;
const WAIT_HINT = /\s*\[wait\s+(\d+(?:\.\d+)?)s?\]\s*$/i;

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
  const wait = Number(m[1]);
  if (!Number.isFinite(wait)) return { text: text.trim(), wait: null };
  return { text: text.replace(WAIT_HINT, '').trim(), wait };
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
    pauseAfter: i === pieces.length - 1 ? endPause : INTRA_LINE_PAUSE_SECONDS,
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
