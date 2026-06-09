import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { selectLessonWords } from '../src/srs.js';
import { generateScript } from '../src/script.js';
import { makeAudio } from '../src/tts.js';
import { today } from '../src/dates.js';

// Local verify WITHOUT GitHub: pick words -> OpenAI script -> Google TTS -> build/lesson.mp3.
// Needs only OPENAI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS in .env.

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env');

  const vocab = await loadVocab();
  const { reviews, news, all } = selectLessonWords(vocab, today());
  console.log(`Words: ${all.map((w) => w.thai).join(', ')}`);

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
