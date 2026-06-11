import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { selectLessonWords } from '../src/srs.js';
import { addTranslations } from '../src/translate.js';
import { loadLessonPlan, chooseLessonType } from '../src/lessons.js';
import { generateScript } from '../src/script.js';
import {
  buildTranscript,
  writeTranscript,
  writeFeedbackTemplate,
  refreshHtml,
  readTranscriptChunks,
  hasTranscript,
  audioPath,
} from '../src/transcript.js';
import { makeAudio } from '../src/tts.js';
import { startServer, openUrl } from '../src/serve.js';
import { PATHS } from '../src/config.js';
import { buildTitle, nextEpisodeNumber } from '../src/episode.js';
import { loadEpisodes, lastEpisodeNumber } from '../src/episodes.js';
import { today } from '../src/dates.js';
import type { Episode } from '../src/types.js';

// One command: make the lesson text, voice it, and open the page. This is the everyday
// driver — `npm run lesson`. The separate `text` and `audio` scripts still exist for when
// you want to edit the transcript by hand between the two steps.
//   npm run lesson                 next lesson by the schedule
//   npm run lesson -- --word=อาหาร  force a specific Thai word
// If a transcript already exists for the target episode, it is voiced as-is (your edits
// are honored) instead of being regenerated.

function getForcedWord(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith('--word='));
  return arg ? arg.slice('--word='.length).trim() : null;
}

// The next episode with no transcript yet, so we never clobber a draft.
function getFreeEpisodeNumber(episodes: Episode[]): number {
  let n = nextEpisodeNumber(lastEpisodeNumber(episodes));
  while (hasTranscript(n)) n += 1;
  return n;
}

async function makeText(number: number, lessonType: string): Promise<void> {
  const vocab = await loadVocab();
  const forcedThai = getForcedWord(process.argv);
  const selected = selectLessonWords(vocab, today());
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

  console.log(`Generating text for lesson #${number} (${lessonType})...`);
  const chunks = await generateScript(news, reviews, { lessonType });
  const title = buildTitle(filled, number);
  const transcript = buildTranscript(chunks, { episodeNumber: number, title, lessonType, words: filled, pubDate: today() });
  await writeTranscript(number, transcript);
  await writeFeedbackTemplate(number);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env');

  const episodes = await loadEpisodes();
  const number = getFreeEpisodeNumber(episodes);
  const lessonType = chooseLessonType(await loadLessonPlan(), number);

  if (hasTranscript(number)) {
    console.log(`Transcript for #${number} already exists — voicing it as-is.`);
  } else {
    await makeText(number, lessonType);
  }

  const chunks = await readTranscriptChunks(number);
  console.log(`Voicing ${chunks.length} lines...`);
  const { durationSeconds } = await makeAudio(chunks, { outPath: audioPath(number) });
  await refreshHtml(number);

  // Serve over http (not file://) so the browser actually loads the audio, then open it.
  // Rooted at episodes/ only — no other repo files (.env, .git) are reachable.
  const { port } = await startServer(PATHS.episodes);
  const url = `http://127.0.0.1:${port}/ep-${number}/index.html`;
  console.log(`Done. Lesson #${number}, ${durationSeconds?.toFixed(1) ?? '?'}s.`);
  console.log(`Opening ${url}`);
  console.log('Serving — press Ctrl-C when you are done listening.');
  openUrl(url);
  // Keep the process alive so the page (and its audio) stays reachable.
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
