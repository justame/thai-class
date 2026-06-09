import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { selectLessonWords } from '../src/srs.js';
import { addTranslations } from '../src/translate.js';
import { generateScript } from '../src/script.js';
import { makeAudio } from '../src/tts.js';
import { today } from '../src/dates.js';

// Local verify WITHOUT GitHub: pick words -> OpenAI script -> Google TTS -> build/lesson.mp3.
// Needs only OPENAI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS in .env.

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env');

  const vocab = await loadVocab();
  const selected = selectLessonWords(vocab, today());
  console.log(`Words: ${selected.all.map((w) => w.thai).join(', ')}`);

  console.log('Translating new words (lazy)...');
  const filled = await addTranslations(selected.all);
  const byId = new Map(filled.map((w) => [w.id, w]));
  const news = selected.news.map((w) => byId.get(w.id));
  const reviews = selected.reviews.map((w) => byId.get(w.id));
  for (const w of filled) console.log(`  ${w.thai} = ${w.english}`);

  console.log('Generating script (OpenAI)...');
  const chunks = await generateScript(news, reviews);
  console.log('\n--- SCRIPT ---');
  for (const c of chunks) console.log(`[${c.lang}/${c.role}] ${c.text}`);

  console.log('\nMaking audio (Google TTS -> MP3)...');
  const { mp3Path, durationSeconds } = await makeAudio(chunks);
  console.log(`\nDone. ${mp3Path} (${durationSeconds?.toFixed(1) ?? '?'}s)`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
