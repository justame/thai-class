import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, DEFAULT_PAUSE_SECONDS, THAI_SPEAKING_RATE, ENGLISH_SPEAKING_RATE } from './config.js';

// The lesson text is saved as an editable transcript per episode. It is the SOURCE the
// audio is voiced from: generate text -> read/edit it -> make audio from exactly that
// text. The format is readable but also parses back into chunks, so edits are honored.
//
// Each spoken line is one row:  [speaker|lang|pauseAfter|rate] text
// The 4th field (rate) is the speaking speed and is OPTIONAL — leave it off to use the
// language default (Thai slowed for beginners, English normal). 1.0 = normal, lower =
// slower. Frontmatter and the "## Words" section are ignored when parsing. Transcripts
// live under docs/transcripts/, so they are committed and public on Pages.

const SPEAKER_LABELS = {
  teacher: 'Teacher',
  student1: 'Student 1',
  student2: 'Student 2',
};

const LINE = /^\[(\w+)\|(th|en)\|([\d.]+)(?:\|([\d.]+))?\]\s+(.*)$/;

function defaultRate(lang) {
  return lang === 'en' ? ENGLISH_SPEAKING_RATE : THAI_SPEAKING_RATE;
}

function transcriptsDir() {
  return join(PATHS.docs, 'transcripts');
}

export function transcriptPath(episodeNumber) {
  return join(transcriptsDir(), `ep-${episodeNumber}.md`);
}

export function hasTranscript(episodeNumber) {
  return existsSync(transcriptPath(episodeNumber));
}

export function buildTranscript(chunks, { episodeNumber, title, lessonType, words, pubDate }) {
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
export function parseTranscript(markdown) {
  const chunks = [];
  for (const raw of markdown.split('\n')) {
    const m = raw.match(LINE);
    if (!m) continue;
    const [, speaker, lang, pause, rate, text] = m;
    if (!text.trim()) continue;
    chunks.push({
      speaker,
      lang,
      text: text.trim(),
      pauseAfter: Number(pause) || DEFAULT_PAUSE_SECONDS,
      rate: rate ? Number(rate) : defaultRate(lang),
    });
  }
  return chunks;
}

export async function writeTranscript(episodeNumber, markdown) {
  await mkdir(transcriptsDir(), { recursive: true });
  const path = transcriptPath(episodeNumber);
  await writeFile(path, markdown, 'utf8');
  return path;
}

export async function readTranscriptChunks(episodeNumber) {
  return parseTranscript(await readFile(transcriptPath(episodeNumber), 'utf8'));
}

// A clean, label-based view for reading (not for parsing).
export function readableView(chunks) {
  const onlyTeacher = chunks.every((c) => c.speaker === 'teacher');
  return chunks
    .map((c) => (onlyTeacher ? c.text : `${SPEAKER_LABELS[c.speaker] ?? c.speaker}: ${c.text}`))
    .join('\n');
}
