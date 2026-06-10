import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { selectLessonWords } from '../src/srs.js';
import { addTranslations } from '../src/translate.js';
import { loadLessonPlan, chooseLessonType } from '../src/lessons.js';
import { generateScript } from '../src/script.js';
import { buildTranscript, writeTranscript, readableView } from '../src/transcript.js';
import { buildTitle, nextEpisodeNumber } from '../src/episode.js';
import { loadEpisodes, lastEpisodeNumber } from '../src/episodes.js';
import { today } from '../src/dates.js';

// Generate the lesson TEXT only (no audio) and save the transcript, so you can read /
// edit it before spending TTS. Run: npm run text

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');

  const vocab = await loadVocab();
  const episodes = await loadEpisodes();
  const number = nextEpisodeNumber(lastEpisodeNumber(episodes));
  const lessonType = chooseLessonType(await loadLessonPlan(), number);

  const selected = selectLessonWords(vocab, today());
  const filled = await addTranslations(selected.all);
  const byId = new Map(filled.map((w) => [w.id, w]));
  const news = selected.news.map((w) => byId.get(w.id));
  const reviews = selected.reviews.map((w) => byId.get(w.id));

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
