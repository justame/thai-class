// Thai must be HEARD in the Thai voice — it carries tones that romanization and the
// English voice cannot. Each Chirp voice reads one script (see [[chirp3-hd-thai-limits]]),
// and voice is chosen by a chunk's lang. So any line that mixes Thai and Latin is split
// here into one chunk per script: Thai parts become lang "th" (Thai voice), the rest stay
// lang "en". This is deterministic — no model call, no romanization, no mangled Thai.

import { MIN_PAUSE_SECONDS } from './config.js';
import type { Chunk, Lang } from './types.js';

const THAI_CHAR = /[฀-๿]/;
const LATIN_CHAR = /[A-Za-z]/;
const THAI_SPAN = /[฀-๿][\s\S]*[฀-๿]|[฀-๿]/; // first Thai char through the last
const HAS_CONTENT = /[A-Za-z0-9฀-๿]/; // a piece worth speaking has a letter or digit

interface Piece {
  lang: Lang;
  text: string;
}

function langOf(char: string): Lang | null {
  if (THAI_CHAR.test(char)) return 'th';
  if (LATIN_CHAR.test(char)) return 'en';
  return null; // spaces, digits, punctuation — stick to the current run
}

// A Thai piece is trimmed to its Thai span so quotes/periods that the model hung on the
// word ("คน'.") do not reach the Thai voice. English pieces keep their punctuation.
function cleanPiece(lang: Lang, raw: string): string {
  if (lang === 'th') {
    const span = raw.match(THAI_SPAN);
    return span ? span[0].trim() : raw.trim();
  }
  return raw.trim();
}

// Break text into ordered { lang, text } pieces, each a single script. Neutral
// characters (spaces, punctuation) attach to the run they sit in. Pieces with no letter
// or digit (stray punctuation) are dropped.
export function splitText(text: string): Piece[] {
  const raw: Piece[] = [];
  let runLang: Lang | null = null;
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) raw.push({ lang: runLang ?? 'en', text: buffer });
    buffer = '';
  };

  for (const char of text) {
    const charLang = langOf(char);
    if (charLang && runLang && charLang !== runLang) flush();
    buffer += char;
    if (charLang) runLang = charLang;
  }
  flush();

  const pieces = raw
    .map((p) => ({ lang: p.lang, text: cleanPiece(p.lang, p.text) }))
    .filter((p) => HAS_CONTENT.test(p.text));
  return pieces.length ? pieces : [{ lang: 'en', text: text.trim() }];
}

// Replace any chunk whose text mixes scripts with one chunk per script piece. The
// original pause goes on the LAST piece; earlier pieces get a short pause so the line
// still flows. Cue chunks are never split.
export function splitMixedScriptLines(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.speaker === 'cue') {
      out.push(chunk);
      continue;
    }
    const pieces = splitText(chunk.text);
    if (pieces.length <= 1) {
      out.push(chunk);
      continue;
    }
    pieces.forEach((piece, i) => {
      const isLast = i === pieces.length - 1;
      out.push({
        ...chunk,
        lang: piece.lang,
        text: piece.text,
        pauseAfter: isLast ? chunk.pauseAfter : MIN_PAUSE_SECONDS,
      });
    });
  }
  return out;
}
