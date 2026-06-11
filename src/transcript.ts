import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, DEFAULT_PAUSE_SECONDS, THAI_SPEAKING_RATE, ENGLISH_SPEAKING_RATE } from './config.js';
import type { Chunk, Lang, Speaker, Word } from './types.js';

// The lesson text is saved as an editable transcript per episode. It is the SOURCE the
// audio is voiced from: generate text -> read/edit it -> make audio from exactly that
// text. The format is readable but also parses back into chunks, so edits are honored.
//
// Each spoken line is one row:  [speaker|lang|pauseAfter|rate] text
// The 4th field (rate) is the speaking speed and is OPTIONAL — leave it off to use the
// language default (Thai slowed for beginners, English normal). 1.0 = normal, lower =
// slower. Frontmatter and the "## Words" section are ignored when parsing. Each episode's
// files live together under episodes/ep-N/ (transcript.md, lesson.mp3, index.html,
// feedback.md); the mp3 is gitignored, the rest are committed.

const SPEAKER_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  student1: 'Student 1',
  student2: 'Student 2',
};

const LINE = /^\[(\w+)\|(th|en)\|([\d.]+)(?:\|([\d.]+))?\]\s+(.*)$/;

function defaultRate(lang: Lang): number {
  return lang === 'en' ? ENGLISH_SPEAKING_RATE : THAI_SPEAKING_RATE;
}

// Every file for one episode lives together in episodes/ep-N/: the editable transcript,
// the audio voiced from it, the readable HTML page, and your feedback notes.
export function episodeDir(episodeNumber: number): string {
  return join(PATHS.episodes, `ep-${episodeNumber}`);
}

export function transcriptPath(episodeNumber: number): string {
  return join(episodeDir(episodeNumber), 'transcript.md');
}

export function audioPath(episodeNumber: number): string {
  return join(episodeDir(episodeNumber), 'lesson.mp3');
}

export function htmlPath(episodeNumber: number): string {
  return join(episodeDir(episodeNumber), 'index.html');
}

export function feedbackPath(episodeNumber: number): string {
  return join(episodeDir(episodeNumber), 'feedback.md');
}

export function hasTranscript(episodeNumber: number): boolean {
  return existsSync(transcriptPath(episodeNumber));
}

// Every episode folder that holds a transcript, lowest number first.
export function listEpisodeNumbers(): number[] {
  if (!existsSync(PATHS.episodes)) return [];
  return readdirSync(PATHS.episodes)
    .map((name) => name.match(/^ep-(\d+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1]))
    .filter((n) => hasTranscript(n))
    .sort((a, b) => a - b);
}

// The newest draft on disk. This is the one `npm run audio` voices by default — you voice
// the transcript you just wrote, not "published + 1" which could be a different episode.
// Returns 0 when there are no transcripts yet.
export function latestTranscriptNumber(): number {
  const numbers = listEpisodeNumbers();
  return numbers.length ? numbers[numbers.length - 1] : 0;
}

export interface BuildTranscriptOptions {
  episodeNumber: number;
  title: string;
  lessonType: string;
  words?: Word[];
  pubDate: string;
}

export function buildTranscript(
  chunks: Chunk[],
  { episodeNumber, title, lessonType, words, pubDate }: BuildTranscriptOptions,
): string {
  const lines = [
    '---',
    `episode: ${episodeNumber}`,
    `title: ${title}`,
    `lesson: ${lessonType}`,
    `date: ${pubDate}`,
    '---',
    '',
    '<!-- One line per spoken line: [speaker|lang|pauseSeconds|rate] text. The 4th field (rate) is optional; lower = slower. Edit freely. -->',
    '',
  ];
  for (const c of chunks) {
    const rate = c.rate ?? defaultRate(c.lang);
    lines.push(`[${c.speaker}|${c.lang}|${c.pauseAfter}|${rate}] ${c.text}`);
  }
  if (words?.length) {
    lines.push('', '## Words', '');
    for (const w of words) lines.push(`- ${w.thai} = ${w.english}`);
  }
  return `${lines.join('\n')}\n`;
}

// Parse the spoken lines back into chunks. Non-matching lines (frontmatter, comments,
// the Words section, blank lines) are skipped.
export function parseTranscript(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const raw of markdown.split('\n')) {
    const m = raw.match(LINE);
    if (!m) continue;
    const [, speaker, lang, pause, rate, text] = m;
    if (!text.trim()) continue;
    chunks.push({
      speaker: speaker as Speaker,
      lang: lang as Lang,
      text: text.trim(),
      pauseAfter: Number(pause) || DEFAULT_PAUSE_SECONDS,
      rate: rate ? Number(rate) : defaultRate(lang as Lang),
    });
  }
  return chunks;
}

export async function writeTranscript(episodeNumber: number, markdown: string): Promise<string> {
  await mkdir(episodeDir(episodeNumber), { recursive: true });
  const path = transcriptPath(episodeNumber);
  await writeFile(path, markdown, 'utf8');
  return path;
}

// Pull the title (frontmatter) and the Words list back out of a saved transcript, so the
// HTML page can be rebuilt from the file alone — after hand-edits, with no other state.
export function parseTranscriptMeta(markdown: string): { title: string; words: Word[] } {
  const titleMatch = markdown.match(/^title:\s*(.+)$/m);
  const words: Word[] = [];
  const wordsSection = markdown.split(/^##\s+Words\s*$/m)[1];
  if (wordsSection) {
    for (const raw of wordsSection.split('\n')) {
      const m = raw.match(/^-\s+(.+?)\s*=\s*(.+)$/);
      if (m) words.push({ thai: m[1].trim(), english: m[2].trim() } as Word);
    }
  }
  return { title: titleMatch ? titleMatch[1].trim() : `Episode`, words };
}

// Rebuild index.html from the current transcript on disk. Called after writing text and
// after voicing, so the page always reflects the latest edits.
export async function refreshHtml(episodeNumber: number): Promise<string> {
  const markdown = await readFile(transcriptPath(episodeNumber), 'utf8');
  const chunks = parseTranscript(markdown);
  const { title, words } = parseTranscriptMeta(markdown);
  const hasAudio = existsSync(audioPath(episodeNumber));
  const html = buildHtml(chunks, { episodeNumber, title, lessonType: '', words, pubDate: '' }, { hasAudio });
  return writeHtml(episodeNumber, html);
}

const FEEDBACK_TEMPLATE = `# Feedback

Note anything that feels off. Reference line numbers from index.html (e.g. "line 4").
When done, tell Claude "process feedback ep-N" — it fixes this episode and, for recurring
issues, adds a rule to lessons/feedback-rules.md so future lessons improve.

-
`;

// Drop a blank feedback file next to the transcript so there is always a place to write
// notes. Never overwrites — your notes are safe across re-runs.
export async function writeFeedbackTemplate(episodeNumber: number): Promise<void> {
  await mkdir(episodeDir(episodeNumber), { recursive: true });
  const path = feedbackPath(episodeNumber);
  if (existsSync(path)) return;
  await writeFile(path, FEEDBACK_TEMPLATE, 'utf8');
}

export async function writeHtml(episodeNumber: number, html: string): Promise<string> {
  await mkdir(episodeDir(episodeNumber), { recursive: true });
  const path = htmlPath(episodeNumber);
  await writeFile(path, html, 'utf8');
  return path;
}

export async function readTranscriptChunks(episodeNumber: number): Promise<Chunk[]> {
  return parseTranscript(await readFile(transcriptPath(episodeNumber), 'utf8'));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HTML_STYLE = `
  :root { color-scheme: light dark; }
  body { font: 17px/1.6 -apple-system, system-ui, sans-serif; max-width: 720px;
    margin: 0 auto; padding: 24px 20px 80px; }
  h1 { font-size: 1.3rem; font-weight: 600; }
  audio { width: 100%; margin: 8px 0 28px; }
  .noaudio { background: rgba(181,89,153,.12); border-radius: 8px; padding: 10px 14px;
    color: #b59; font-size: .9rem; }
  .noaudio code { background: rgba(127,127,127,.18); padding: 1px 5px; border-radius: 4px; }
  ol.lines { list-style: none; padding: 0; margin: 0; }
  li.line { display: grid; grid-template-columns: 2.2rem 1fr; gap: 12px;
    padding: 10px 8px; border-radius: 8px; }
  li.line:nth-child(even) { background: rgba(127,127,127,.07); }
  .num { color: #999; font-variant-numeric: tabular-nums; font-size: .8rem;
    padding-top: .35rem; text-align: right; }
  .who { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em;
    color: #888; margin-bottom: 2px; }
  .th { font-size: 1.5rem; line-height: 1.4; }
  .en { color: #777; }
  .cue { grid-column: 2; color: #b59; font-size: .72rem; text-transform: uppercase;
    letter-spacing: .05em; }
  .words { margin-top: 36px; border-top: 1px solid rgba(127,127,127,.25); padding-top: 16px; }
  .words h2 { font-size: 1rem; } .words li { margin: 4px 0; }
  .words .th { font-size: 1.1rem; }`;

// A self-contained reading page for one episode. Opened from disk (file://) — the audio
// player points at lesson.mp3 sitting in the SAME folder. Lines are numbered so feedback
// in feedback.md can say "line 4". Not parsed back; transcript.md is the editable source.
export interface BuildHtmlOptions {
  hasAudio?: boolean;
}

export function buildHtml(
  chunks: Chunk[],
  { title, words }: BuildTranscriptOptions,
  { hasAudio = true }: BuildHtmlOptions = {},
): string {
  const onlyTeacher = chunks.every((c) => c.speaker === 'teacher' || c.speaker === 'cue');
  let lineNo = 0;
  const rows = chunks.map((c) => {
    if (c.speaker === 'cue') {
      return `      <li class="line"><span class="num"></span><span class="cue">— ${escapeHtml(c.text)} —</span></li>`;
    }
    lineNo += 1;
    const who = onlyTeacher ? '' : `<div class="who">${escapeHtml(SPEAKER_LABELS[c.speaker] ?? c.speaker)}</div>`;
    const body = `<div class="${c.lang}">${escapeHtml(c.text)}</div>`;
    return `      <li class="line" data-line="${lineNo}"><span class="num">${lineNo}</span><div>${who}${body}</div></li>`;
  });
  const wordRows = (words ?? []).map(
    (w) => `      <li><span class="th">${escapeHtml(w.thai)}</span> = ${escapeHtml(w.english)}</li>`,
  );
  const wordsBlock = wordRows.length
    ? `\n    <section class="words">\n      <h2>Words</h2>\n      <ul>\n${wordRows.join('\n')}\n      </ul>\n    </section>`
    : '';
  const player = hasAudio
    ? `<audio controls src="lesson.mp3"></audio>`
    : `<p class="noaudio">No audio yet — run <code>npm run audio</code> for this episode, then reload.</p>`;
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${player}
  <ol class="lines">
${rows.join('\n')}
  </ol>${wordsBlock}
</body>
</html>
`;
}

// A clean, label-based view for reading (not for parsing).
export function readableView(chunks: Chunk[]): string {
  const onlyTeacher = chunks.every((c) => c.speaker === 'teacher');
  return chunks
    .map((c) => (onlyTeacher ? c.text : `${SPEAKER_LABELS[c.speaker] ?? c.speaker}: ${c.text}`))
    .join('\n');
}
