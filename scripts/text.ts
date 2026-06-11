import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { selectLessonWords } from '../src/srs.js';
import { addTranslations } from '../src/translate.js';
import { loadLessonPlan, chooseLessonType } from '../src/lessons.js';
import { generateScript } from '../src/script.js';
import { buildTranscript, writeTranscript, readableView, hasTranscript } from '../src/transcript.js';
import { buildTitle, nextEpisodeNumber } from '../src/episode.js';
import { loadEpisodes, lastEpisodeNumber } from '../src/episodes.js';
import { today } from '../src/dates.js';
import type { Episode } from '../src/types.js';

// Generate the lesson TEXT only (no audio) and save the transcript, so you can read /
// edit it before spending TTS.
//   npm run text                  next word by the schedule
//   npm run text -- --word=อาหาร   force a specific Thai word (the schedule has no topic
//                                  control, so this is how you pick a theme like food)

// The forced word, if the caller passed --word=<thai>.
function getForcedWord(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith('--word='));
  return arg ? arg.slice('--word='.length).trim() : null;
}

// The next episode number that has no transcript yet, so we never clobber a draft.
function getFreeEpisodeNumber(episodes: Episode[]): number {
  let n = nextEpisodeNumber(lastEpisodeNumber(episodes));
  while (hasTranscript(n)) n += 1;
  return n;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');

  const vocab = await loadVocab();
  const episodes = await loadEpisodes();
  const number = getFreeEpisodeNumber(episodes);
  const lessonType = chooseLessonType(await loadLessonPlan(), number);

  const forcedThai = getForcedWord(process.argv);
  const selected = selectLessonWords(vocab, today());
  // Force the new word when asked; otherwise use the scheduled one. Reviews stay scheduled.
  if (forcedThai) {
    const word = vocab.find((w) => w.thai === forcedThai);
    if (!word) throw new Error(`Word "${forcedThai}" is not in vocab.json`);
    selected.news = [word];
    selected.all = [word, ...selected.reviews];
  }
  const filled = await addTranslations(selected.all);
  const byId = new Map(filled.map((w) => [w.id, w]));
  const news = selected.news.map((w) => byId.get(w.id)!);
  const reviews = selected.reviews.map((w) => byId.get(w.id)!);

  console.log(`Lesson #${number} (${lessonType}). Generating text...`);
  const chunks = await generateScript(news, reviews, { lessonType });

  const title = buildTitle(filled, number);
  const transcript = buildTranscript(chunks, { episodeNumber: number, title, lessonType, words: filled, pubDate: today() });
  const path = await writeTranscript(number, transcript);

  console.log(`\n${readableView(chunks)}\n`);
  console.log(`Saved editable transcript to ${path}`);
  console.log('Read/edit it, then run "npm run audio" to hear it (or "npm start" to publish).');
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
